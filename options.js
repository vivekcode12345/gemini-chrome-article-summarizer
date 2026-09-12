import { getProvider } from "./providers.js";

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key");
  const saveButton = document.getElementById("save-button");
  const successMessage = document.getElementById("success-message");
  const toggleVisibilityBtn = document.getElementById("toggle-visibility");
  const keyStatusBadge = document.getElementById("key-status-badge");
  const testConnBtn = document.getElementById("test-connection-btn");
  const testFeedback = document.getElementById("test-feedback");
  const apiKeyLabel = document.getElementById("api-key-label");
  const apiKeyHelper = document.getElementById("api-key-helper");
  const optionCards = document.querySelectorAll(".option-card");
  const providerCards = document.querySelectorAll('#provider-grid .option-card');

  let selectedProvider = "gemini";
  let selectedFormat = "brief";
  let selectedTheme = "system";

  const THEME_SYNC_KEY = "theme";
  const THEME_LOCAL_MIRROR_KEY = "ai-summarizer-theme";

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
      try {
        localStorage.setItem(THEME_LOCAL_MIRROR_KEY, theme);
      } catch (e) {}
    } else {
      document.documentElement.removeAttribute("data-theme");
      try {
        localStorage.removeItem(THEME_LOCAL_MIRROR_KEY);
      } catch (e) {}
    }
  }

  function selectTheme(theme, persist = true) {
    selectedTheme = theme === "light" || theme === "dark" ? theme : "system";
    document.querySelectorAll("#theme-grid .option-card").forEach((card) => {
      const isSelected = card.getAttribute("data-value") === selectedTheme;
      card.classList.toggle("selected", isSelected);
      const radio = card.querySelector("input[type='radio']");
      if (radio) radio.checked = isSelected;
    });
    applyTheme(selectedTheme);
    if (persist) {
      try {
        chrome.storage.sync.set({ [THEME_SYNC_KEY]: selectedTheme });
      } catch (e) {}
    }
  }

  document.querySelectorAll("#theme-grid .option-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectTheme(card.getAttribute("data-value"));
    });
  });

  const PROVIDER_HELPERS = {
    gemini: {
      label: "Gemini API Key",
      helper: 'Need an API key? You can get one from <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a>.',
      placeholder: "Paste your Gemini API key here",
    },
    openai: {
      label: "OpenAI API Key",
      helper: 'Need an API key? You can get one from <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a>.',
      placeholder: "Paste your OpenAI API key here",
    },
    anthropic: {
      label: "Anthropic API Key",
      helper: 'Need an API key? You can get one from <a href="https://console.anthropic.com/settings/keys" target="_blank">Anthropic Console</a>.',
      placeholder: "Paste your Anthropic API key here",
    },
  };

  function updateBadge(hasKey) {
    if (!keyStatusBadge) return;
    if (hasKey) {
      keyStatusBadge.textContent = "● Key Configured";
      keyStatusBadge.className = "key-badge saved";
    } else {
      keyStatusBadge.textContent = "○ No Key Saved";
      keyStatusBadge.className = "key-badge missing";
    }
  }

  function applyProviderMeta(providerId) {
    const meta = PROVIDER_HELPERS[providerId] || PROVIDER_HELPERS.gemini;
    if (apiKeyLabel) apiKeyLabel.textContent = meta.label;
    if (apiKeyHelper) apiKeyHelper.innerHTML = meta.helper;
    if (apiKeyInput) apiKeyInput.placeholder = meta.placeholder;
  }

  function selectProvider(providerId) {
    selectedProvider = providerId;
    providerCards.forEach((card) => {
      const isSelected = card.getAttribute("data-value") === providerId;
      card.classList.toggle("selected", isSelected);
      const radio = card.querySelector("input[type='radio']");
      if (radio) radio.checked = isSelected;
    });
    applyProviderMeta(providerId);
    loadApiKeyForProvider(providerId);
  }

  providerCards.forEach((card) => {
    card.addEventListener("click", () => {
      selectProvider(card.getAttribute("data-value"));
    });
  });

  function getStorageKeyForProvider(providerId) {
    if (providerId === "openai") return "openaiApiKey";
    if (providerId === "anthropic") return "anthropicApiKey";
    return "geminiApiKey";
  }

  function loadApiKeyForProvider(providerId) {
    const storageKey = getStorageKeyForProvider(providerId);
    chrome.storage.sync.get([storageKey], (result) => {
      const value = result[storageKey];
      if (apiKeyInput) apiKeyInput.value = value || "";
      updateBadge(!!value);
    });
  }

  // Toggle API key visibility with SVG icons
  if (toggleVisibilityBtn && apiKeyInput) {
    toggleVisibilityBtn.addEventListener("click", () => {
      const isPassword = apiKeyInput.type === "password";
      apiKeyInput.type = isPassword ? "text" : "password";
      toggleVisibilityBtn.title = isPassword ? "Hide API key" : "Show API key";
      toggleVisibilityBtn.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>`;
    });
  }

  // Default summary format card selection
  const formatCards = Array.from(optionCards).filter((card) => !providerCards.includes(card));
  formatCards.forEach((card) => {
    card.addEventListener("click", () => {
      formatCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      const radio = card.querySelector("input[type='radio']");
      if (radio) radio.checked = true;
      selectedFormat = card.getAttribute("data-value");
    });
  });

  // Load saved settings
  chrome.storage.sync.get(
    ["geminiApiKey", "openaiApiKey", "anthropicApiKey", "defaultSummaryType", "aiProvider", "theme"],
    (result) => {
      if (result.theme === "light" || result.theme === "dark") {
        selectTheme(result.theme, false);
      } else {
        selectTheme("system", false);
      }
      if (result.aiProvider) {
        selectedProvider = result.aiProvider;
      }
      selectProvider(selectedProvider);

      if (result.defaultSummaryType) {
        selectedFormat = result.defaultSummaryType;
        const targetCard = document.querySelector(`.option-card[data-value="${selectedFormat}"]:not(#provider-grid .option-card)`);
        if (targetCard) {
          optionCards.forEach((c) => {
            if (!providerCards.contains(c)) c.classList.remove("selected");
          });
          targetCard.classList.add("selected");
          const radio = targetCard.querySelector("input[type='radio']");
          if (radio) radio.checked = true;
        }
      }
    }
  );

  // Test Connection
  testConnBtn?.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      testFeedback.textContent = "Please enter an API key first.";
      testFeedback.className = "test-feedback error";
      return;
    }

    testFeedback.textContent = "Testing...";
    testFeedback.className = "test-feedback";
    testConnBtn.disabled = true;

    const startTime = Date.now();
    try {
      const provider = getProvider(selectedProvider);
      const endpoint = provider.buildEndpoint(provider.defaultModel, key);
      const body = provider.buildRequest("ping", provider.defaultModel);
      const headers = {
        "Content-Type": "application/json",
        ...(provider.needsAuthHeader ? provider.authHeader(key) : {}),
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const latency = Date.now() - startTime;
      const data = await res.json();

      if (res.ok) {
        testFeedback.textContent = `✓ Connected successfully (${latency}ms)`;
        testFeedback.className = "test-feedback success";
      } else {
        const errorMsg = data.error?.message || "Invalid API key";
        testFeedback.textContent = `✕ Failed: ${errorMsg}`;
        testFeedback.className = "test-feedback error";
      }
    } catch (err) {
      testFeedback.textContent = `✕ Error: ${err.message}`;
      testFeedback.className = "test-feedback error";
    } finally {
      testConnBtn.disabled = false;
    }
  });

  // Floating toast + footer message for save feedback
  let toastTimer = null;
  function showSaveSuccess(message = "✓ Successfully updated! Opening extension…") {
    const floatingToast = document.getElementById("save-toast");
    if (floatingToast) {
      floatingToast.textContent = message;
      floatingToast.classList.add("show");
      if (toastTimer) clearTimeout(toastTimer);
    }
    if (successMessage) {
      successMessage.textContent = "✓ Successfully updated!";
      successMessage.style.display = "inline-flex";
    }
  }

  function hideSaveSuccess() {
    const floatingToast = document.getElementById("save-toast");
    if (floatingToast) floatingToast.classList.remove("show");
    if (successMessage) successMessage.style.display = "none";
  }

  async function openExtensionPopup() {
    // 1) Ask background service worker to open the action popup
    try {
      const res = await chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
      if (res?.ok) return true;
    } catch (e) {}
    // 2) Try directly (works in newer Chrome when called with user gesture)
    try {
      if (chrome.action?.openPopup) {
        await chrome.action.openPopup();
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Save settings
  function saveSettings() {
    const apiKey = apiKeyInput.value.trim();
    const storageKey = getStorageKeyForProvider(selectedProvider);

    if (!apiKey) {
      alert(`Please enter a valid ${PROVIDER_HELPERS[selectedProvider].label}.`);
      return;
    }

    const payload = {
      [storageKey]: apiKey,
      defaultSummaryType: selectedFormat,
      aiProvider: selectedProvider,
      theme: selectedTheme,
    };

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";
    }

    chrome.storage.sync.set(payload, () => {
      updateBadge(true);
      showSaveSuccess();

      // Give the user a moment to see the success message, then open the extension
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(async () => {
        await openExtensionPopup();
        // Close the Options tab so the user lands back on their article.
        // If openPopup succeeded this is seamless; otherwise they can click the toolbar icon.
        try {
          window.close();
        } catch (e) {}
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.textContent = "Save Settings";
        }
        setTimeout(hideSaveSuccess, 1500);
      }, 1200);
    });
  }

  saveButton.addEventListener("click", saveSettings);

  apiKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      saveSettings();
    }
  });
});
