import { getProvider, SUMMARY_LANGUAGES } from "./providers.js";

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key");
  const saveButton = document.getElementById("save-button");
  const defaultLangSelect = document.getElementById("default-language");
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
  let selectedLanguage = "en";
  // Tracks whether the user has typed in the key field since the last
  // provider switch / initial load, so async storage reads never wipe typing.
  let isApiKeyDirty = false;

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
        storageSet({ [THEME_SYNC_KEY]: selectedTheme }, () => {});
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
    // Switching provider means we want to show that provider's saved key,
    // so allow the async load to populate the field.
    isApiKeyDirty = false;
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

  // Storage helpers: write to sync AND local (sync can be disabled/unsigned),
  // read from sync first with local fallback.
  function storageGet(keys, callback) {
    if (chrome?.storage?.sync) {
      try {
        chrome.storage.sync.get(keys, (syncRes) => {
          if (chrome.runtime.lastError) {
            console.warn("sync.get failed, trying local:", chrome.runtime.lastError.message);
            chrome.storage.local.get(keys, (localRes) => callback(localRes || {}));
            return;
          }
          const hasValue = keys.some((k) => syncRes && syncRes[k]);
          if (hasValue) {
            callback(syncRes || {});
          } else if (chrome?.storage?.local) {
            chrome.storage.local.get(keys, (localRes) => {
              const merged = { ...(localRes || {}), ...(syncRes || {}) };
              // Prefer whichever actually has values
              callback(Object.keys(localRes || {}).length ? merged : (syncRes || {}));
            });
          } else {
            callback(syncRes || {});
          }
        });
        return;
      } catch (err) {
        console.warn("sync.get crashed, trying local:", err);
      }
    }
    if (chrome?.storage?.local) {
      chrome.storage.local.get(keys, (localRes) => callback(localRes || {}));
    } else {
      callback({});
    }
  }

  function storageSet(obj, callback) {
    let pending = 0;
    let lastErr = null;
    const done = (err) => {
      if (err) lastErr = err;
      pending -= 1;
      if (pending <= 0 && callback) callback(lastErr);
    };
    if (chrome?.storage?.sync) {
      pending += 1;
      try {
        chrome.storage.sync.set(obj, () => done(chrome.runtime.lastError ? new Error(chrome.runtime.lastError.message) : null));
      } catch (err) {
        done(err);
      }
    }
    if (chrome?.storage?.local) {
      pending += 1;
      try {
        chrome.storage.local.set(obj, () => done(chrome.runtime.lastError ? new Error(chrome.runtime.lastError.message) : null));
      } catch (err) {
        done(err);
      }
    }
    if (pending === 0 && callback) callback(new Error("No extension storage available"));
  }

  function loadApiKeyForProvider(providerId) {
    const storageKey = getStorageKeyForProvider(providerId);
    if (!chrome?.storage) {
      console.error("chrome.storage unavailable — open Options via the extension, not as a file.");
      return;
    }
    storageGet([storageKey], (result) => {
      // Never overwrite what the user just typed.
      if (isApiKeyDirty) return;
      const value = result?.[storageKey];
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

  // Default summary format card selection (scoped to #format-grid only,
  // so theme cards are never affected)
  const formatCards = document.querySelectorAll("#format-grid .option-card");
  formatCards.forEach((card) => {
    card.addEventListener("click", () => {
      formatCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      const radio = card.querySelector("input[type='radio']");
      if (radio) radio.checked = true;
      selectedFormat = card.getAttribute("data-value");
    });
  });

  // Default language dropdown (populated from shared SUMMARY_LANGUAGES)
  if (defaultLangSelect && Array.isArray(SUMMARY_LANGUAGES)) {
    defaultLangSelect.innerHTML = SUMMARY_LANGUAGES.map(
      (l) => `<option value="${l.code}">${l.label}</option>`
    ).join("");
    defaultLangSelect.value = "en";
    defaultLangSelect.addEventListener("change", () => {
      selectedLanguage = defaultLangSelect.value || "en";
    });
  }

  // Load saved settings — guarded so a missing chrome.storage API
  // can never prevent the buttons below from working.
  function loadSavedSettings() {
    if (!chrome?.storage) {
      console.error("chrome.storage unavailable. Open Options via chrome://extensions > Details > Extension options, not as a file.");
      selectTheme("system", false);
      selectProviderWithoutLoad("gemini");
      if (testFeedback) {
        testFeedback.textContent = "Extension storage unavailable. Reload the extension and open Options from the toolbar.";
        testFeedback.className = "test-feedback error";
      }
      return;
    }
    try {
      storageGet(
        ["geminiApiKey", "openaiApiKey", "anthropicApiKey", "defaultSummaryType", "aiProvider", "theme", "defaultLanguage"],
        (result) => {
          const res = result || {};
          if (res.defaultLanguage && defaultLangSelect) {
            const valid = SUMMARY_LANGUAGES.some((l) => l.code === res.defaultLanguage)
              ? res.defaultLanguage
              : "en";
            selectedLanguage = valid;
            defaultLangSelect.value = valid;
          }
          if (res.theme === "light" || res.theme === "dark") {
            selectTheme(res.theme, false);
          } else {
            selectTheme("system", false);
          }
          if (res.aiProvider) {
            selectedProvider = res.aiProvider;
          }
          selectProvider(selectedProvider);

          if (res.defaultSummaryType) {
            selectedFormat = res.defaultSummaryType;
            const targetCard = document.querySelector(`#format-grid .option-card[data-value="${selectedFormat}"]`);
            if (targetCard) {
              formatCards.forEach((c) => c.classList.remove("selected"));
              targetCard.classList.add("selected");
              const radio = targetCard.querySelector("input[type='radio']");
              if (radio) radio.checked = true;
            }
          }
        }
      );
    } catch (err) {
      console.error("Load settings crashed:", err);
    }
  }

  // Select provider + UI without triggering an async key load
  // (used when storage is unavailable).
  function selectProviderWithoutLoad(providerId) {
    selectedProvider = providerId;
    providerCards.forEach((card) => {
      const isSelected = card.getAttribute("data-value") === providerId;
      card.classList.toggle("selected", isSelected);
      const radio = card.querySelector("input[type='radio']");
      if (radio) radio.checked = isSelected;
    });
    applyProviderMeta(providerId);
  }

  // Test Connection
  testConnBtn?.addEventListener("click", async () => {
    const key = (apiKeyInput?.value || "").trim();
    if (testFeedback && !key) {
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
    if (!apiKeyInput || !saveButton) {
      console.error("Save failed: form elements not found");
      return;
    }
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
      defaultLanguage: defaultLangSelect?.value || selectedLanguage || "en",
    };

    saveButton.disabled = true;
    saveButton.textContent = "Saving…";

    if (!chrome?.storage) {
      alert("Extension storage unavailable. Reload the extension in chrome://extensions and open Options from the toolbar.");
      saveButton.disabled = false;
      saveButton.textContent = "Save Settings";
      return;
    }

    try {
      storageSet(payload, (err) => {
        if (err) {
          console.error("Save failed:", err.message);
          alert(`Save failed: ${err.message}`);
          saveButton.disabled = false;
          saveButton.textContent = "Save Settings";
          return;
        }
        isApiKeyDirty = false;
        updateBadge(true);
        // Verify the write so users can confirm the key persisted
        storageGet([storageKey, "aiProvider"], (check) => {
          console.log("Saved. Storage now:", check);
          if (!check?.[storageKey]) {
            console.warn("Save verification failed: key not found after write");
            alert("Warning: key did not persist. Check chrome.storage access.");
          }
        });
        showSaveSuccess("✓ Successfully updated!");

      // Give the user a moment to see the success message, then try to open the extension.
      // Only auto-close the tab if the popup actually opened — otherwise stay
      // so the user can see the ● Key Configured badge.
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(async () => {
        const opened = await openExtensionPopup();
        if (opened) {
          try {
            window.close();
          } catch (e) {}
        } else {
          showSaveSuccess("✓ Successfully updated! Click the toolbar icon to open the extension.");
        }
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.textContent = "Save Settings";
        }
        setTimeout(hideSaveSuccess, 1500);
      }, 1200);
    });
    } catch (err) {
      console.error("Save crashed:", err);
      alert(`Save failed: ${err?.message || err}`);
      saveButton.disabled = false;
      saveButton.textContent = "Save Settings";
    }
  }

  saveButton?.addEventListener("click", saveSettings);

  // Mark the field dirty on any user edit so async loads never wipe typing.
  apiKeyInput?.addEventListener("input", () => {
    isApiKeyDirty = true;
  });

  apiKeyInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      saveSettings();
    }
  });

  // Attach listeners first, then load — so buttons work even if storage fails.
  loadSavedSettings();
});
