document.addEventListener("DOMContentLoaded", () => {
  const summarizeBtn = document.getElementById("summarize");
  const copyBtn = document.getElementById("copy-btn");
  const resultDiv = document.getElementById("result");
  const summaryType = document.getElementById("summary-type");

  summarizeBtn.addEventListener("click", async () => {
    resultDiv.innerHTML = "<div class='loader'>Generating summary...</div>";

    chrome.storage.sync.get(["geminiApiKey"], async (storage) => {
      if (!storage.geminiApiKey) {
        resultDiv.innerHTML =
          "❌ Gemini API Key not found.<br><br>Please open the extension options and save your API key.";
        return;
      }

      chrome.tabs.query(
        { active: true, currentWindow: true },
        (tabs) => {
          if (!tabs.length) {
            resultDiv.innerText = "No active tab found.";
            return;
          }

          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              type: "GET_ARTICLE_TEXT",
            },
            async (response) => {
              if (chrome.runtime.lastError) {
                resultDiv.innerHTML =
                  "❌ " + chrome.runtime.lastError.message;
                return;
              }

              if (!response || !response.success) {
                resultDiv.innerHTML =
                  "❌ Could not extract article.";
                return;
              }

              if (response.text.length < 100) {
                resultDiv.innerHTML =
                  "❌ This page doesn't contain enough article text.";
                return;
              }

              try {
                const summary = await getGeminiSummary(
                  response.text,
                  summaryType.value,
                  storage.geminiApiKey
                );

                resultDiv.innerText = summary;

              } catch (e) {
                resultDiv.innerHTML =
                  "<b>Error:</b><br>" + e.message;
              }
            }
          );
        }
      );
    });
  });
  async function getGeminiSummary(text, summaryType, apiKey) {
  const maxLength = 20000;
  const article =
    text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;

  let prompt = "";

  switch (summaryType) {
    case "brief":
      prompt = `Summarize the following article in 2-3 sentences:\n\n${article}`;
      break;

    case "detailed":
      prompt = `Provide a detailed summary of the following article:\n\n${article}`;
      break;

    case "bullets":
      prompt = `Summarize the following article into 5-7 bullet points:\n\n${article}`;
      break;

    default:
      prompt = `Summarize the following article:\n\n${article}`;
  }

  const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
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
          maxOutputTokens: 1024
        }
      })
    }
  );

  const data = await response.json();

  console.log("Gemini Response:", data);

  if (!response.ok) {
    throw new Error(data.error?.message || "Gemini API Error");
  }

  if (
    data.candidates &&
    data.candidates.length &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts.length
  ) {
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error("No summary returned by Gemini.");
}

  copyBtn.addEventListener("click", async () => {
    const text = resultDiv.innerText.trim();

    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      copyBtn.innerText = "Copied!";
      setTimeout(() => {
        copyBtn.innerText = "Copy Summary";
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  });
});