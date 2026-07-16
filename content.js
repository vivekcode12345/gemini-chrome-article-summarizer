function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function getArticleText() {
  // Try <article> tag first
  const article = document.querySelector("article");
  if (article) {
    const text = cleanText(article.innerText);
    if (text.length > 300) return text;
  }

  // Common article selectors
  const selectors = [
    "main",
    "[role='main']",
    ".article-content",
    ".article-body",
    ".post-content",
    ".entry-content",
    ".story-content",
    ".content",
    "#content",
    ".main-content"
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);

    if (element) {
      const text = cleanText(element.innerText);
      if (text.length > 300) {
        return text;
      }
    }
  }

  // Collect paragraphs
  const paragraphs = [...document.querySelectorAll("p")]
    .map((p) => cleanText(p.innerText))
    .filter((t) => t.length > 40);

  if (paragraphs.length > 5) {
    return paragraphs.join("\n\n");
  }

  return cleanText(document.body.innerText);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_ARTICLE_TEXT") {
    try {
      const text = getArticleText();

      sendResponse({
        success: true,
        text: text
      });

    } catch (err) {
      console.error(err);

      sendResponse({
        success: false,
        text: "",
        error: err.message
      });
    }

    return true;
  }
});