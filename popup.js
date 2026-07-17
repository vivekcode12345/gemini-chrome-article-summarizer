// Show loading state
function showLoading(message = "Generating summary...") {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    <div class="loader">
      <div class="spinner"></div>
      <div class="loader-text">${message}</div>
    </div>
  `;
}

// Show error message
function showError(message) {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `<b>Error:</b><br>${message}`;
}

// Get article text from active tab
async function getArticleTextFromTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_ARTICLE_TEXT" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || !response.success) {
        reject(new Error("Could not extract article text."));
        return;
      }

      if (response.text.length < 100) {
        reject(new Error("This page doesn't contain enough article text."));
        return;
      }

      resolve(response.text);
    });
  });
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
      prompt = `You are a professional summarizer. Write a brief summary of the following article in exactly 2-3 sentences. Write in clear, natural language. Do not use markdown formatting, headings, or bullet points. Do not start with phrases like "Here is the summary" or "In summary". Just write the summary directly as plain text paragraphs.

Article:
${article}`;
      break;

    case "detailed":
      prompt = `You are a professional summarizer. Write a detailed summary of the following article in 250-400 words. Write in clear, natural language using well-structured paragraphs. Do not use markdown formatting, headings (###), bold (**), or bullet points. Do not start with phrases like "Here is the summary" or "In this article". Just write the summary directly as plain text. Cover all main points and key details from the article.

Article:
${article}`;
      break;

    case "bullets":
      prompt = `You are a professional summarizer. Summarize the following article into exactly 5-7 key points. Format each point as a simple dash followed by a space (- ). Do not use asterisks, numbers, or any other bullet symbols. Do not use markdown formatting. Do not add any introductory text. Just list the bullet points directly.

Example format:
- First key point from the article
- Second key point from the article
- Third key point from the article

Article:
${article}`;
      break;

    default:
      prompt = `You are a professional summarizer. Summarize the following article in clear, natural language. Do not use markdown formatting, headings, or bullet points. Write in plain text paragraphs only.

Article:
${article}`;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          topP: 0.95,
          topK: 40
        }
      })
    }
  );

  const data = await response.json();

  console.log("Gemini Response:", data);

  if (!response.ok) {
    const errorMsg = data.error?.message || "Gemini API Error";
    
    // Handle specific error cases
    if (errorMsg.includes("API key")) {
      throw new Error("Invalid API key. Please check your Gemini API key in options.");
    }
    if (errorMsg.includes("quota") || errorMsg.includes("rate limit")) {
      throw new Error("API quota exceeded. Please try again later.");
    }
    
    throw new Error(errorMsg);
  }

  if (
    data.candidates &&
    data.candidates.length &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts.length
  ) {
    const summary = data.candidates[0].content.parts[0].text;
    
    // Clean up the summary
    return summary
      .replace(/^#+\s*/gm, "") // Remove markdown headings
      .replace(/\*\*/g, "") // Remove bold markers
      .replace(/\*/g, "") // Remove italic markers
      .replace(/^-\s*/gm, "- ") // Normalize bullet points
      .trim();
  }

  throw new Error("No summary returned by Gemini.");
}

// Copy summary to clipboard
async function copySummaryToClipboard() {
  const copyBtn = document.getElementById("copy-btn");
  const resultDiv = document.getElementById("result");
  const text = resultDiv.innerText.trim();

  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    const originalText = copyBtn.innerText;
    copyBtn.innerText = "✓ Copied!";
    setTimeout(() => {
      copyBtn.innerText = originalText;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}

// Main summarization logic
async function summarizeArticle() {
  const summarizeBtn = document.getElementById("summarize");
  const copyBtn = document.getElementById("copy-btn");
  const resultDiv = document.getElementById("result");
  const summaryType = document.getElementById("summary-type");

  summarizeBtn.addEventListener("click", async () => {
    showLoading("Extracting article text...");

    try {
      // Get API key
      const storage = await new Promise((resolve) => {
        chrome.storage.sync.get(["geminiApiKey"], resolve);
      });

      if (!storage.geminiApiKey) {
        resultDiv.innerHTML = `
          <b>❌ API Key Missing</b><br><br>
          Please open the extension options and save your Gemini API key.
        `;
        return;
      }

      // Get active tab
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });

      if (!tabs.length) {
        showError("No active tab found.");
        return;
      }

      // Extract article text
      showLoading("Extracting article text...");
      const articleText = await getArticleTextFromTab(tabs[0].id);

      // Generate summary
      showLoading("Generating summary with AI...");
      const summary = await getGeminiSummary(articleText, summaryType.value, storage.geminiApiKey);

      // Display summary
      resultDiv.innerText = summary;

    } catch (error) {
      console.error("Summarization error:", error);
      showError(error.message);
    }
  });

  // Copy button handler
  copyBtn.addEventListener("click", copySummaryToClipboard);
}

// Initialize extension when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", summarizeArticle);
} else {
  summarizeArticle();
}
