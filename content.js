function getArticleText() {
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
    .filter(text => text.length > 50) // Filter out very short paragraphs
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

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_ARTICLE_TEXT") {
    try {
      const text = getArticleText();
      sendResponse({ text: text || "" });
    } catch (error) {
      console.error("Error extracting article text:", error);
      sendResponse({ text: "" });
    }
  }
  return true; // Keep the message channel open for async response
});
