document.getElementById("summarize").addEventListener("click", async () => {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = '<div class="loading"><div class="loader"></div></div>';

  const summaryType = document.getElementById("summary-type").value;

  // Get API key from storage
  chrome.storage.sync.get(["geminiApiKey"], async (result) => {
    if (!result.geminiApiKey) {
      resultDiv.innerHTML =
        "API key not found. Please set your API key in the extension options.";
      return;
    }

    try {
      chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
        try {
          console.log("Attempting to extract text from tab:", tab.id);
          
          // Inject content script dynamically using scripting API
          const [injectionResult] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: getArticleTextFunction,
          });

          console.log("Injection result:", injectionResult);
          const text = injectionResult?.result || "";
          console.log("Extracted text length:", text.length);
          console.log("Extracted text preview:", text.substring(0, 200));

          if (!text || text.trim().length === 0) {
            resultDiv.innerHTML = `
              <strong>Could not extract article text from this page.</strong><br><br>
              <small>Possible reasons:<br>
              - The page doesn't have readable article content<br>
              - The page is still loading<br>
              - Try refreshing the page and clicking again<br><br>
              <em>Check the browser console (F12) for more details.</em></small>
            `;
            return;
          }

          resultDiv.innerHTML = '<div class="loading"><div class="loader"></div></div>';
          
          const summary = await getGeminiSummary(
            text,
            summaryType,
            result.geminiApiKey
          );
          resultDiv.innerText = summary;
        } catch (error) {
          console.error("Error during summarization:", error);
          resultDiv
function getArticleTextFunction() {
  // Try to find article element first
  const article = document.querySelector("article");
  if (article && article.innerText.trim().length > 100) {
    return article.innerText.trim();
  }

  // Try common article/content selectors
  const contentSelectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    'main',
    '.main-content'
  ];

  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element && element.innerText.trim().length > 100) {
      return element.innerText.trim();
    }
  }

  // Fallback: Get all paragraphs and filter out short ones
  const paragraphs = Array.from(document.querySelectorAll("p"))
    .map(p => p.innerText.trim())
    .filter(text => text.length > 50)
    .join("\n\n");

  if (paragraphs.length > 100) {
    return paragraphs;
  }

  // Last resort: Get all text from the body, excluding scripts and styles
  const bodyText = Array.from(document.body.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, td, th"))
    .map(el => el.innerText.trim())
    .filter(text => text.length > 30)
    .join("\n\n");

  return bodyText || "";
}

document.getElementById("copy-btn").addEventListener("click", () => {
  const summaryText = document.getElementById("result").innerText;

  if (summaryText && summaryText.trim() !== "") {
    navigator.clipboard
      .writeText(summaryText)
      .then(() => {
        const copyBtn = document.getElementById("copy-btn");
        const originalText = copyBtn.innerText;

        copyBtn.innerText = "Copied!";
        setTimeout(() => {
          copyBtn.innerText = originalText;
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  }
});

async function getGeminiSummary(text, summaryType, apiKey) {
  // Truncate very long texts to avoid API limits (typically around 30K tokens)
  const maxLength = 20000;
  const truncatedText =
    text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

  let prompt;
  switch (summaryType) {
    case "brief":
      prompt = `Provide a brief summary of the following article in 2-3 sentences:\n\n${truncatedText}`;
      break;
    case "detailed":
      prompt = `Provide a detailed summary of the following article, covering all main points and key details:\n\n${truncatedText}`;
      break;
    case "bullets":
      prompt = `Summarize the following article in 5-7 key points. Format each point as a line starting with "- " (dash followed by a space). Do not use asterisks or other bullet symbols, only use the dash. Keep each point concise and focused on a single key insight from the article:\n\n${truncatedText}`;
      break;
    default:
      prompt = `Summarize the following article:\n\n${truncatedText}`;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || "API request failed");
    }

    const data = await res.json();
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No summary available."
    );
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate summary. Please try again later.");
  }
}