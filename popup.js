// State
let currentSummaryRaw = "";

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
      <div class="alert-desc">Please enter your Gemini API key in Settings to summarize articles.</div>
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

// Call Gemini API and get summary
async function getGeminiSummary(text, summaryType, apiKey) {
  const maxLength = 30000;
  const article =
    text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;

  let prompt = "";

  switch (summaryType) {
    case "brief":
      prompt = `You are a professional summarizer. Write a concise summary of the following article in exactly 2-3 clear sentences. Capture the primary thesis and key takeaway. You may use **bold** text for key concepts.

Article:
${article}`;
      break;

    case "detailed":
      prompt = `You are a professional summarizer. Write a comprehensive summary of the following article in 250-400 words. Organize the summary into well-structured paragraphs with clear section headings (###) and use **bold** text for important takeaways, terms, or metrics. Cover all key arguments and context.

Article:
${article}`;
      break;

    case "bullets":
      prompt = `You are a professional summarizer. Summarize the following article into 5-7 key takeaway bullet points. Format each point starting with "- " and use **bold** for the core concept at the start of each bullet point.

Article:
${article}`;
      break;

    default:
      prompt = `You are a professional summarizer. Summarize the following article in clear, natural language with markdown formatting where appropriate.

Article:
${article}`;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          topP: 0.95,
          topK: 40,
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini API Error Response:", data);
    throw new Error(
      data.error?.message ||
      JSON.stringify(data.error) ||
      "Unknown Gemini API Error"
    );
  }

  if (
    data.candidates &&
    data.candidates.length &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts.length
  ) {
    return data.candidates[0].content.parts[0].text.trim();
  }

  throw new Error("No summary returned by Gemini.");
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

  // Populate active tab context
  initTabContext();

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
      // Fetch API key from storage
      const storage = await new Promise((resolve) => {
        chrome.storage.sync.get(["geminiApiKey"], resolve);
      });

      if (!storage.geminiApiKey) {
        showApiKeyMissing();
        return;
      }

      // Query active tab
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });

      if (!tabs.length || !tabs[0].id) {
        showError("No active browser tab found.");
        return;
      }

      const activeTab = tabs[0];

      // Block restricted pages
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

      // 1. Extract
      showLoading("Extracting article text...");
      const articleText = await getArticleTextFromTab(activeTab.id);

      // 2. Generate
      showLoading("Generating summary with Gemini 3.6 Flash...");
      const currentType = summaryTypeInput ? summaryTypeInput.value : "brief";
      const summary = await getGeminiSummary(articleText, currentType, storage.geminiApiKey);

      // 3. Render Output
      currentSummaryRaw = summary;
      resultDiv.innerHTML = renderMarkdown(summary);

      // 4. Update Word Count & Reading Time in Toolbar
      const words = summary.trim().split(/\s+/).filter(Boolean).length;
      const readingTime = Math.max(1, Math.ceil(words / 180));
      const wordCountEl = document.getElementById("word-count");
      if (wordCountEl) {
        wordCountEl.textContent = `${words} words (~${readingTime} min read)`;
      }

      const resultToolbar = document.getElementById("result-toolbar");
      if (resultToolbar) resultToolbar.style.display = "flex";

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
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
