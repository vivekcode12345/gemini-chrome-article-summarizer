document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key");
  const saveButton = document.getElementById("save-button");
  const successMessage = document.getElementById("success-message");

  // Load saved API key
  chrome.storage.sync.get(["geminiApiKey"], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
  });

  // Save API key
  saveButton.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      alert("Please enter your Gemini API Key.");
      return;
    }

    chrome.storage.sync.set(
      {
        geminiApiKey: apiKey,
      },
      () => {
        successMessage.style.display = "block";

        setTimeout(() => {
          successMessage.style.display = "none";
        }, 2000);
      }
    );
  });
});