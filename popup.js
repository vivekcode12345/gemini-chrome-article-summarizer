import { getProvider, getSummaryFromProvider, streamSummaryFromProvider } from "./providers.js";
import {
  saveHistoryItem,
  loadHistory,
  loadFavorites,
  toggleFavorite,
  deleteHistoryItem,
  clearHistory,
} from "./history.js";

// State
let currentSummaryRaw = "";
let currentHistoryItemId = null;
let currentHistoryFilter = "all";
let isHistoryPanelOpen = false;

// Theme (light / dark / system) — persisted in chrome.storage.sync + localStorage mirror for flash-free load
const THEME_SYNC_KEY = "theme";
const THEME_LOCAL_MIRROR_KEY = "ai-summarizer-theme";

function getEffectiveTheme() {
  const override = document.documentElement.getAttribute("data-theme");
  if (override === "light" || override === "dark") return override;
  if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function updateThemeIcon(effectiveTheme) {
  const moonIcon = document.getElementById("theme-icon-moon");
  const sunIcon = document.getElementById("theme-icon-sun");
  const themeBtn = document.getElementById("theme-btn");
  if (!moonIcon || !sunIcon) return;
  const isDark = effectiveTheme === "dark";
  moonIcon.style.display = isDark ? "none" : "block";
  sunIcon.style.display = isDark ? "block" : "none";
  if (themeBtn) {
    themeBtn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  }
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_LOCAL_MIRROR_KEY, theme);
    } catch (e) {}
  } else {
    // "system" — follow OS preference
    document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.removeItem(THEME_LOCAL_MIRROR_KEY);
    } catch (e) {}
  }
  updateThemeIcon(getEffectiveTheme());
}

function initTheme() {
  // Fast path: inline <head> script already applied localStorage mirror, just sync icon
  updateThemeIcon(getEffectiveTheme());

  try {
    chrome.storage.sync.get([THEME_SYNC_KEY], (res) => {
      if (res && (res[THEME_SYNC_KEY] === "light" || res[THEME_SYNC_KEY] === "dark")) {
        applyTheme(res[THEME_SYNC_KEY]);
      } else {
        applyTheme("system");
      }
    });
  } catch (e) {}

  try {
    chrome.storage.sync.onChanged.addListener((changes) => {
      if (changes[THEME_SYNC_KEY]) {
        const next = changes[THEME_SYNC_KEY].newValue;
        applyTheme(next === "light" || next === "dark" ? next : "system");
      }
    });
  } catch (e) {}

  // Keep icon in sync when OS theme changes while in "system" mode
  try {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!document.documentElement.getAttribute("data-theme")) {
        updateThemeIcon(getEffectiveTheme());
      }
    };
    if (typeof media.addEventListener === "function") media.addEventListener("change", onChange);
    else if (typeof media.addListener === "function") media.addListener(onChange);
  } catch (e) {}
}

function toggleTheme() {
  const next = getEffectiveTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    chrome.storage.sync.set({ [THEME_SYNC_KEY]: next });
  } catch (e) {}
}

// Escape HTML for XSS safety
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Format inline markdown (bold, italic, code)
function formatInline(text) {
  let escaped = escapeHtml(text);

  // Inline code: `code`
  escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold: **text** or __text__
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  escaped = escaped.replace(/\b_([^_]+)_\b/g, "<em>$1</em>");

  return escaped;
}

// Convert markdown to clean HTML
function renderMarkdown(md) {
  if (!md) return "";

  const lines = md.trim().split(/\r?\n/);
  const html = [];
  let inList = false;
  let listType = null; // 'ul' | 'ol'
  let inCodeBlock = false;
  let codeBlockLines = [];

  const closeList = () => {
    if (inList) {
      html.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check for code blocks
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        // Close code block
        html.push(`<pre class="summary-pre"><code>${escapeHtml(codeBlockLines.join("\n"))}</code></pre>`);
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      closeList();
      continue;
    }

    // Heading: #, ##, ###, ####
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = Math.min(headingMatch[1].length + 1, 5);
      html.push(`<h${level} class="summary-heading">${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list item: -, *, +
    const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        closeList();
        html.push('<ul class="summary-list">');
        inList = true;
        listType = "ul";
      }
      html.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list item: 1. 2. etc.
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        closeList();
        html.push('<ol class="summary-list">');
        inList = true;
        listType = "ol";
      }
      html.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    // Blockquote: > text
    const quoteMatch = trimmed.match(/^>\s*(.+)$/);
    if (quoteMatch) {
      closeList();
      html.push(`<blockquote class="summary-quote">${formatInline(quoteMatch[1])}</blockquote>`);
      continue;
    }

    // Regular paragraph
    closeList();
    html.push(`<p class="summary-para">${formatInline(trimmed)}</p>`);
  }

  closeList();
  if (inCodeBlock && codeBlockLines.length) {
    html.push(`<pre class="summary-pre"><code>${escapeHtml(codeBlockLines.join("\n"))}</code></pre>`);
  }

  return `<div class="summary-content">${html.join("")}</div>`;
}

// Show streaming placeholder in the result area
function showStreamingPlaceholder(providerLabel) {
  const resultToolbar = document.getElementById("result-toolbar");
  if (resultToolbar) resultToolbar.style.display = "none";

  const summarizeBtn = document.getElementById("summarize");
  if (summarizeBtn) summarizeBtn.disabled = true;

  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    <div class="streaming-container">
      <div class="streaming-header">
        <div class="mini-spinner"></div>
        <span>Generating with ${escapeHtml(providerLabel)}...</span>
      </div>
      <div id="streaming-content" class="streaming-content"></div>
    </div>
  `;
}

function appendStreamChunk(chunk) {
  const container = document.getElementById("streaming-content");
  if (!container) return;
  const existing = container.getAttribute("data-raw") || "";
  const combined = existing + chunk;
  container.setAttribute("data-raw", combined);
  container.innerHTML = renderMarkdown(combined);
  const resultDiv = document.getElementById("result");
  if (resultDiv) resultDiv.scrollTop = resultDiv.scrollHeight;
}

function finalizeStream(providerLabel) {
  const container = document.getElementById("streaming-content");
  const raw = container?.getAttribute("data-raw") || "";
  currentSummaryRaw = raw;
  const resultDiv = document.getElementById("result");
  if (resultDiv) resultDiv.innerHTML = renderMarkdown(raw);

  const words = raw.trim().split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(words / 180));
  const wordCountEl = document.getElementById("word-count");
  if (wordCountEl) {
    wordCountEl.textContent = `${words} words (~${readingTime} min read)`;
  }

  const resultToolbar = document.getElementById("result-toolbar");
  if (resultToolbar) resultToolbar.style.display = "flex";
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function truncateText(text, maxLength = 120) {
  if (!text) return "";
  const cleaned = text.replace(/\n+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).trim() + "...";
}

async function renderHistoryList() {
  const historyList = document.getElementById("history-list");
  if (!historyList) return;

  let items = await loadHistory();
  if (currentHistoryFilter === "favorites") {
    items = items.filter((item) => item.isFavorite);
  }

  if (!items.length) {
    historyList.innerHTML = `<div class="history-empty">No summaries yet.</div>`;
    return;
  }

  historyList.innerHTML = items
    .map((item) => {
      const domain = (() => {
        try {
          return new URL(item.url).hostname.replace(/^www\./, "");
        } catch {
          return "";
        }
      })();
      const dateLabel = formatDate(item.createdAt);
      const favClass = item.isFavorite ? "fav-active" : "";
      const starLabel = item.isFavorite ? "Remove from favorites" : "Add to favorites";

      return `
        <div class="history-item" data-id="${item.id}">
          <div class="history-item-header">
            <div class="history-item-title">${escapeHtml(item.title || "Untitled")}</div>
            <button class="history-item-btn ${favClass}" data-action="fav" data-id="${item.id}" title="${starLabel}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="${item.isFavorite ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </button>
          </div>
          <div class="history-item-meta">
            ${domain ? `<span>${escapeHtml(domain)}</span>` : ""}
            <span>${escapeHtml(item.mode || "brief")}</span>
            <span>${dateLabel}</span>
          </div>
          <div class="history-item-summary">${escapeHtml(truncateText(item.summary))}</div>
          <div class="history-item-actions">
            <button class="history-item-btn" data-action="open" data-id="${item.id}">Open</button>
            <button class="history-item-btn" data-action="delete" data-id="${item.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");

  historyList.querySelectorAll(".history-item-btn[data-action='fav']").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const updated = await toggleFavorite(id);
      await renderHistoryList();
      await updateFavoriteButtonState(updated);
    });
  });

  historyList.querySelectorAll(".history-item-btn[data-action='open']").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const history = await loadHistory();
      const item = history.find((entry) => entry.id === id);
      if (item) {
        await openHistoryItem(item);
      }
    });
  });

  historyList.querySelectorAll(".history-item-btn[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      await deleteHistoryItem(id);
      if (currentHistoryItemId === id) {
        currentHistoryItemId = null;
      }
      await renderHistoryList();
      updateFavoriteButtonStateFromId(currentHistoryItemId);
    });
  });

  historyList.querySelectorAll(".history-item").forEach((el) => {
    el.addEventListener("click", async () => {
      const id = el.getAttribute("data-id");
      const history = await loadHistory();
      const item = history.find((entry) => entry.id === id);
      if (item) {
        await openHistoryItem(item);
      }
    });
  });
}

async function openHistoryItem(item) {
  currentSummaryRaw = item.summary;
  currentHistoryItemId = item.id;
  const resultDiv = document.getElementById("result");
  if (resultDiv) {
    resultDiv.innerHTML = renderMarkdown(item.summary);
  }
  const words = item.summary.trim().split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(words / 180));
  const wordCountEl = document.getElementById("word-count");
  if (wordCountEl) {
    wordCountEl.textContent = `${words} words (~${readingTime} min read)`;
  }
  const resultToolbar = document.getElementById("result-toolbar");
  if (resultToolbar) resultToolbar.style.display = "flex";
  await updateFavoriteButtonState(item);
  if (isHistoryPanelOpen) {
    toggleHistoryPanel();
  }
}

async function updateFavoriteButtonState(item) {
  const favBtn = document.getElementById("fav-btn");
  const favLabel = document.getElementById("fav-label");
  if (!favBtn) return;
  if (item?.isFavorite) {
    favBtn.classList.add("favorited");
    if (favLabel) favLabel.textContent = "Favorited";
  } else {
    favBtn.classList.remove("favorited");
    if (favLabel) favLabel.textContent = "Favorite";
  }
}

async function updateFavoriteButtonStateFromId(id) {
  if (!id) {
    await updateFavoriteButtonState({ isFavorite: false });
    return;
  }
  const history = await loadHistory();
  const item = history.find((entry) => entry.id === id);
  await updateFavoriteButtonState(item || { isFavorite: false });
}

async function toggleHistoryPanel() {
  const panel = document.getElementById("history-panel");
  const historyBtn = document.getElementById("history-btn");
  if (!panel) return;

  isHistoryPanelOpen = !isHistoryPanelOpen;
  if (isHistoryPanelOpen) {
    panel.style.display = "flex";
    if (historyBtn) historyBtn.classList.add("active");
    await renderHistoryList();
  } else {
    panel.style.display = "none";
    if (historyBtn) historyBtn.classList.remove("active");
  }
}

// Show shimmer skeleton loading state
function showLoading(status = "Analyzing with Gemini 3.6 Flash...") {
  const resultToolbar = document.getElementById("result-toolbar");
  if (resultToolbar) resultToolbar.style.display = "none";

  const summarizeBtn = document.getElementById("summarize");
  if (summarizeBtn) summarizeBtn.disabled = true;

  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    <div class="loader-container">
      <div class="loader-status">
        <div class="mini-spinner"></div>
        <span>${escapeHtml(status)}</span>
      </div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line full"></div>
      <div class="skeleton-line full"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line full" style="margin-top: 14px;"></div>
      <div class="skeleton-line full"></div>
      <div class="skeleton-line short"></div>
    </div>
  `;
}

// Show error notice
function showError(message) {
  const resultToolbar = document.getElementById("result-toolbar");
  if (resultToolbar) resultToolbar.style.display = "none";

  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    <div class="alert-card">
      <div class="alert-icon-wrapper danger">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="alert-title">Unable to Summarize</div>
      <div class="alert-desc">${escapeHtml(message)}</div>
    </div>
  `;
}

// Show API key missing card
function showApiKeyMissing() {
  const resultToolbar = document.getElementById("result-toolbar");
  if (resultToolbar) resultToolbar.style.display = "none";

  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    <div class="alert-card">
      <div class="alert-icon-wrapper warning">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <div class="alert-title">API Key Required</div>
      <div class="alert-desc">Please enter your API key in Settings to summarize articles.</div>
      <button id="open-settings-inline" class="btn-alert">Open Settings</button>
    </div>
  `;
  document.getElementById("open-settings-inline")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

// Send message to content script with dynamic injection fallback
async function getArticleTextFromTab(tabId) {
  const sendMessage = () => {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: "GET_ARTICLE_TEXT" }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }

        if (!response || !response.success) {
          return reject(new Error(response?.error || "Could not extract article text from this page."));
        }

        if (!response.text || response.text.length < 100) {
          return reject(new Error("This page does not contain enough article text to summarize."));
        }

        resolve(response.text);
      });
    });
  };

  try {
    return await sendMessage();
  } catch (err) {
    const isConnError =
      err.message &&
      (err.message.includes("Receiving end does not exist") ||
        err.message.includes("Could not establish connection"));

    // Fallback: Dynamically inject content.js if not yet active in this tab
    if (isConnError) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content.js"],
        });

        // Brief delay to allow content script to initialize
        await new Promise((resolve) => setTimeout(resolve, 150));
        return await sendMessage();
      } catch (injectErr) {
        if (injectErr.message && injectErr.message.includes("Cannot access")) {
          throw new Error("Cannot summarize browser internal or restricted pages.");
        }
        throw new Error("Could not connect to page content: " + injectErr.message);
      }
    }
    throw err;
  }
}


// Copy summary to clipboard
async function copySummaryToClipboard() {
  const copyBtn = document.getElementById("copy-btn");
  const copyLabel = document.getElementById("copy-label");
  const resultDiv = document.getElementById("result");
  const text = currentSummaryRaw || resultDiv.innerText.trim();

  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.classList.add("copied");
    if (copyLabel) copyLabel.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      if (copyLabel) copyLabel.textContent = "Copy";
    }, 2000);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}

// Initialize active tab preview with favicon
async function initTabContext() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length && tabs[0].title) {
      const activeTab = tabs[0];
      const titleEl = document.getElementById("tab-title");
      const favImg = document.getElementById("tab-favicon");
      const fallbackIcon = document.getElementById("tab-fallback-icon");

      let domain = "";
      try {
        const url = new URL(activeTab.url);
        domain = url.hostname.replace(/^www\./, "");
      } catch (e) {}

      if (titleEl) {
        titleEl.textContent = domain ? `${domain} • ${activeTab.title}` : activeTab.title;
      }

      if (activeTab.favIconUrl && !activeTab.favIconUrl.startsWith("chrome://")) {
        if (favImg) {
          favImg.src = activeTab.favIconUrl;
          favImg.style.display = "block";
          favImg.onerror = () => {
            favImg.style.display = "none";
            if (fallbackIcon) fallbackIcon.style.display = "block";
          };
          if (fallbackIcon) fallbackIcon.style.display = "none";
        }
      }
    }
  } catch (err) {
    console.error("Error fetching active tab info:", err);
  }
}

// Main application initialization
async function initApp() {
  const summarizeBtn = document.getElementById("summarize");
  const summarizeLabel = document.getElementById("summarize-btn-label");
  const shortcutKbd = document.querySelector(".shortcut-kbd");
  const copyBtn = document.getElementById("copy-btn");
  const clearBtn = document.getElementById("clear-btn");
  const resultDiv = document.getElementById("result");
  const summaryTypeInput = document.getElementById("summary-type");
  const settingsBtn = document.getElementById("settings-btn");
  const segmentBtns = document.querySelectorAll(".segment-btn");
  const modelBadge = document.querySelector(".model-badge");

  let currentProviderId = "gemini";
  let currentProviderLabel = "Gemini 3.6 Flash";

  async function loadProviderMeta() {
    const storage = await new Promise((resolve) => {
      chrome.storage.sync.get(["aiProvider"], resolve);
    });
    const providerId = storage.aiProvider || "gemini";
    currentProviderId = providerId;
    const provider = getProvider(providerId);
    currentProviderLabel = `${provider.label} ${provider.defaultModel}`;
    if (modelBadge) modelBadge.innerHTML = `<span class="status-dot"></span>${currentProviderLabel}`;
  }

  loadProviderMeta();
  chrome.storage.sync.onChanged.addListener((changes) => {
    if (changes.aiProvider) loadProviderMeta();
  });

  // Populate active tab context
  initTabContext();

  // Theme toggle (light / dark, defaults to system)
  initTheme();
  document.getElementById("theme-btn")?.addEventListener("click", toggleTheme);

  // Settings button navigation
  settingsBtn?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // Clear / Reset button handler
  clearBtn?.addEventListener("click", () => {
    currentSummaryRaw = "";
    const resultToolbar = document.getElementById("result-toolbar");
    if (resultToolbar) resultToolbar.style.display = "none";
    resultDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
        <div class="empty-title">Ready to summarize</div>
        <div class="empty-desc">
          Click <strong>Summarize Article</strong> or press <strong>⌘↵</strong> to generate an instant AI synthesis of this page.
        </div>
      </div>
    `;
  });

  // Segmented control tabs
  segmentBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      segmentBtns.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      const type = btn.getAttribute("data-type");
      if (summaryTypeInput) summaryTypeInput.value = type;
      chrome.storage.local.set({ lastSelectedType: type });
    });
  });

  // Restore preferred or last selected summary type
  chrome.storage.sync.get(["defaultSummaryType"], (syncRes) => {
    const preferred = syncRes.defaultSummaryType;
    if (preferred) {
      const targetBtn = document.querySelector(`.segment-btn[data-type="${preferred}"]`);
      if (targetBtn) targetBtn.click();
    } else {
      chrome.storage.local.get(["lastSelectedType"], (localRes) => {
        if (localRes.lastSelectedType) {
          const targetBtn = document.querySelector(`.segment-btn[data-type="${localRes.lastSelectedType}"]`);
          if (targetBtn) targetBtn.click();
        }
      });
    }
  });

  // Keyboard shortcut hint for non-Mac
  if (typeof navigator !== "undefined" && !navigator.platform.includes("Mac")) {
    if (shortcutKbd) shortcutKbd.textContent = "Ctrl↵";
  }

  // Keyboard shortcut trigger (Cmd+Enter / Ctrl+Enter)
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      summarizeBtn?.click();
    }
  });

  // Summarize click handler
  summarizeBtn?.addEventListener("click", async () => {
    showLoading("Extracting article text...");
    if (summarizeLabel) summarizeLabel.textContent = "Summarizing...";
    if (shortcutKbd) shortcutKbd.style.opacity = "0.3";

    try {
      const storage = await new Promise((resolve) => {
        chrome.storage.sync.get(["geminiApiKey", "openaiApiKey", "anthropicApiKey", "aiProvider"], resolve);
      });
      const providerId = storage.aiProvider || "gemini";
      const provider = getProvider(providerId);
      const apiKey = storage[provider.apiKeyStorageKey];

      if (!apiKey) {
        showApiKeyMissing();
        return;
      }

      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });

      if (!tabs.length || !tabs[0].id) {
        showError("No active browser tab found.");
        return;
      }

      const activeTab = tabs[0];

      if (
        activeTab.url &&
        (activeTab.url.startsWith("chrome://") ||
          activeTab.url.startsWith("chrome-extension://") ||
          activeTab.url.startsWith("edge://") ||
          activeTab.url.startsWith("about:"))
      ) {
        showError("Cannot summarize browser internal pages. Please open an article or blog post.");
        return;
      }

      showLoading(`Extracting article text...`);
      const articleText = await getArticleTextFromTab(activeTab.id);

      const currentType = summaryTypeInput ? summaryTypeInput.value : "brief";
      showStreamingPlaceholder(provider.label);

      let fullText = "";
      try {
        for await (const chunk of streamSummaryFromProvider(articleText, currentType, providerId, apiKey)) {
          fullText += chunk;
          appendStreamChunk(chunk);
        }
      } catch (streamError) {
        console.error("Streaming failed, falling back to non-streaming:", streamError);
        try {
          fullText = await getSummaryFromProvider(articleText, currentType, providerId, apiKey);
        } catch (fallbackError) {
          throw fallbackError;
        }
      }

      if (!fullText.trim()) {
        throw new Error("No summary returned by provider.");
      }

      finalizeStream(provider.label);

      const tabsForHistory = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });
      const activeTabForHistory = tabsForHistory[0];
      const savedItem = await saveHistoryItem({
        url: activeTabForHistory?.url || "",
        title: activeTabForHistory?.title || "",
        summary: currentSummaryRaw,
        mode: currentType,
        providerLabel: provider.label,
      });
      currentHistoryItemId = savedItem.id;
      await updateFavoriteButtonState(savedItem);

    } catch (error) {
      console.error("Summarization error:", error);
      showError(error.message);
    } finally {
      if (summarizeBtn) summarizeBtn.disabled = false;
      if (summarizeLabel) summarizeLabel.textContent = "Summarize Article";
      if (shortcutKbd) shortcutKbd.style.opacity = "1";
    }
  });

  // Copy button handler
  copyBtn?.addEventListener("click", copySummaryToClipboard);

  // Favorite button handler
  const favBtn = document.getElementById("fav-btn");
  favBtn?.addEventListener("click", async () => {
    if (!currentSummaryRaw || !currentHistoryItemId) return;
    const updated = await toggleFavorite(currentHistoryItemId);
    await updateFavoriteButtonState(updated);
    if (isHistoryPanelOpen) {
      await renderHistoryList();
    }
  });

  // History button handler
  const historyBtn = document.getElementById("history-btn");
  historyBtn?.addEventListener("click", async () => {
    await toggleHistoryPanel();
  });

  // History filters
  const historyAllBtn = document.getElementById("history-fav-filter");
  const historyFavBtn = document.getElementById("history-fav-filter-fav");
  const clearHistoryBtn = document.getElementById("clear-history-btn");

  historyAllBtn?.addEventListener("click", async () => {
    currentHistoryFilter = "all";
    historyAllBtn.classList.add("active");
    if (historyFavBtn) historyFavBtn.classList.remove("active");
    await renderHistoryList();
  });

  historyFavBtn?.addEventListener("click", async () => {
    currentHistoryFilter = "favorites";
    historyFavBtn.classList.add("active");
    if (historyAllBtn) historyAllBtn.classList.remove("active");
    await renderHistoryList();
  });

  clearHistoryBtn?.addEventListener("click", async () => {
    if (confirm("Clear all history and favorites?")) {
      await clearHistory();
      currentHistoryItemId = null;
      await updateFavoriteButtonState({ isFavorite: false });
      await renderHistoryList();
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
