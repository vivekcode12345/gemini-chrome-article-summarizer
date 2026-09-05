document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key");
  const saveButton = document.getElementById("save-button");
  const successMessage = document.getElementById("success-message");
  const toggleVisibilityBtn = document.getElementById("toggle-visibility");
  const keyStatusBadge = document.getElementById("key-status-badge");
  const testConnBtn = document.getElementById("test-connection-btn");
  const testFeedback = document.getElementById("test-feedback");
  const optionCards = document.querySelectorAll(".option-card");

  let selectedFormat = "brief";

  // Update status badge
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
  optionCards.forEach((card) => {
    card.addEventListener("click", () => {
      optionCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      const radio = card.querySelector("input[type='radio']");
      if (radio) radio.checked = true;
      selectedFormat = card.getAttribute("data-value");
    });
  });

  // Load saved settings
  chrome.storage.sync.get(["geminiApiKey", "defaultSummaryType"], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
      updateBadge(true);
    } else {
      updateBadge(false);
    }

    if (result.defaultSummaryType) {
      selectedFormat = result.defaultSummaryType;
      const targetCard = document.querySelector(`.option-card[data-value="${selectedFormat}"]`);
      if (targetCard) {
        optionCards.forEach((c) => c.classList.remove("selected"));
        targetCard.classList.add("selected");
        const radio = targetCard.querySelector("input[type='radio']");
        if (radio) radio.checked = true;
      }
    }
  });

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
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "ping" }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        }
      );

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

  // Save settings
  function saveSettings() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      alert("Please enter a valid Gemini API Key.");
      return;
    }

    chrome.storage.sync.set(
      {
        geminiApiKey: apiKey,
        defaultSummaryType: selectedFormat,
      },
      () => {
        updateBadge(true);
        if (successMessage) {
          successMessage.style.display = "inline-flex";
          setTimeout(() => {
            successMessage.style.display = "none";
          }, 3000);
        }
      }
    );
  }

  saveButton.addEventListener("click", saveSettings);

  apiKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      saveSettings();
    }
  });
});