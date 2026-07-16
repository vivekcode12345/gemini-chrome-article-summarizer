function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function removeNoiseElements() {
  // Remove common noise elements before extraction
  const noiseSelectors = [
    // Cookie banners
    '[id*="cookie"]',
    '[class*="cookie"]',
    '[id*="consent"]',
    '[class*="consent"]',
    '[id*="gdpr"]',
    '[class*="gdpr"]',
    // Navigation
    'nav',
    'header',
    'footer',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    // Ads
    '[id*="ad-"]',
    '[class*="ad-"]',
    '[id*="ads-"]',
    '[class*="ads-"]',
    '[id*="advertisement"]',
    '[class*="advertisement"]',
    // Comments
    '[id*="comment"]',
    '[class*="comment"]',
    '[id*="disqus"]',
    '[class*="disqus"]',
    // Sidebars
    'aside',
    '[id*="sidebar"]',
    '[class*="sidebar"]',
    '[id*="related"]',
    '[class*="related"]',
    // Social media
    '[id*="social"]',
    '[class*="social"]',
    '[id*="share"]',
    '[class*="share"]'
  ];

  noiseSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => el.remove());
    } catch (e) {
      // Ignore errors
    }
  });
}

function getArticleText() {
  // Remove noise elements first
  removeNoiseElements();

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

  // Collect paragraphs (filter out short ones)
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