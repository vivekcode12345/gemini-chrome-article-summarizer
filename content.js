/**
 * AI Article Summarizer - Content Script
 * Extracts clean article text from web pages without modifying the DOM
 */

// ==================== TEXT CLEANING UTILITIES ====================

/**
 * Clean and normalize text
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, " ")           // Normalize whitespace
    .replace(/\n+/g, "\n")          // Normalize newlines
    .replace(/[^\S\n]+/g, " ")      // Remove spaces (except newlines)
    .trim();
}

/**
 * Check if text is too short to be meaningful
 */
function isTooShort(text, minLength = 40) {
  return text.length < minLength;
}

/**
 * Check if text is likely noise (repeated patterns, etc.)
 */
function isNoiseText(text) {
  // Check for repeated characters (e.g., "....", "----")
  if (/(.)\1{4,}/.test(text)) return true;
  
  // Check for common noise patterns
  const noisePatterns = [
    /^cookie/i,
    /^accept\s*(all|necessary)/i,
    /^decline/i,
    /^subscribe/i,
    /^sign\s*up/i,
    /^newsletter/i,
    /^follow\s*us/i,
    /^share\s*this/i,
    /^related\s*posts/i,
    /^you\s*might\s*also/i,
    /^read\s*more/i,
    /^continue\s*reading/i,
    /^advertisement/i,
    /^sponsored/i,
    /^copyright/i,
    /^all\s*rights\s*reserved/i,
    /^powered\s*by/i,
    /^developed\s*by/i
  ];
  
  return noisePatterns.some(pattern => pattern.test(text));
}

/**
 * Check if text is a duplicate of previously seen text
 */
function isDuplicate(text, seenTexts) {
  const normalized = text.toLowerCase().trim();
  return seenTexts.has(normalized);
}

// ==================== DOM CLONING AND NOISE REMOVAL ====================

/**
 * Clone the document and remove noise elements from the clone
 * This ensures we never modify the user's actual webpage
 */
function getCleanedDocument() {
  // Clone the entire document
  const clone = document.documentElement.cloneNode(true);
  
  // Remove noise elements from the clone
  removeNoiseFromClone(clone);
  
  return clone;
}

/**
 * Remove unwanted elements from a cloned document
 */
function removeNoiseFromClone(clone) {
  // Comprehensive noise selectors
  const noiseSelectors = [
    // Cookie banners and consent dialogs
    '[id*="cookie" i]',
    '[class*="cookie" i]',
    '[id*="consent" i]',
    '[class*="consent" i]',
    '[id*="gdpr" i]',
    '[class*="gdpr" i]',
    '[id*="onetrust" i]',
    '[class*="onetrust" i]',
    
    // Navigation and headers
    'nav',
    'header',
    'footer',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="search"]',
    
    // Advertisements
    '[id*="ad-" i]',
    '[class*="ad-" i]',
    '[id*="ads-" i]',
    '[class*="ads-" i]',
    '[id*="advertisement" i]',
    '[class*="advertisement" i]',
    '[id*="google_ads" i]',
    '[class*="google_ads" i]',
    
    // Comments and discussion
    '[id*="comment" i]',
    '[class*="comment" i]',
    '[id*="disqus" i]',
    '[class*="disqus" i]',
    '[id*="discourse" i]',
    '[class*="discourse" i]',
    
    // Sidebars and related content
    'aside',
    '[id*="sidebar" i]',
    '[class*="sidebar" i]',
    '[id*="related" i]',
    '[class*="related" i]',
    '[id*="recommend" i]',
    '[class*="recommend" i]',
    '[id*="suggested" i]',
    '[class*="suggested" i]',
    
    // Social media and sharing
    '[id*="social" i]',
    '[class*="social" i]',
    '[id*="share" i]',
    '[class*="share" i]',
    '[id*="follow" i]',
    '[class*="follow" i]',
    
    // Newsletter and subscription forms
    '[id*="newsletter" i]',
    '[class*="newsletter" i]',
    '[id*="subscribe" i]',
    '[class*="subscribe" i]',
    '[id*="signup" i]',
    '[class*="signup" i]',
    '[id*="sign-up" i]',
    '[class*="sign-up" i]',
    
    // Popups and modals
    '[id*="modal" i]',
    '[class*="modal" i]',
    '[id*="popup" i]',
    '[class*="popup" i]',
    '[id*="overlay" i]',
    '[class*="overlay" i]',
    
    // Author bio and author boxes
    '[id*="author-bio" i]',
    '[class*="author-bio" i]',
    '[id*="authorbox" i]',
    '[class*="authorbox" i]',
    '[id*="author_info" i]',
    '[class*="author_info" i]',
    
    // Footer elements
    '[id*="footer" i]',
    '[class*="footer" i]',
    '[id*="copyright" i]',
    '[class*="copyright" i]',
    
    // Scripts, styles, and hidden elements
    'script',
    'style',
    'noscript',
    '[hidden]',
    '[aria-hidden="true"]',
    'iframe',
    'svg'
  ];
  
  // Remove all noise elements from the clone
  noiseSelectors.forEach(selector => {
    try {
      const elements = clone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    } catch (e) {
      // Ignore invalid selectors
    }
  });
}

// ==================== ARTICLE EXTRACTION ====================

/**
 * Extract text from a cloned element
 */
function extractTextFromElement(element) {
  if (!element) return "";
  
  // Get all text nodes and paragraphs
  const textParts = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip empty or whitespace-only text
        if (!node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip script and style content
        const parent = node.parentElement;
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text) {
      textParts.push(text);
    }
  }
  
  return textParts.join("\n\n");
}

/**
 * Extract article text using multiple strategies
 * Works on a cloned document to avoid modifying the live page
 */
function getArticleText() {
  // Step 1: Clone the document and remove noise
  const clonedDoc = getCleanedDocument();
  
  // Step 2: Try extraction strategies in priority order
  const text = extractWithPriority(clonedDoc);
  
  // Step 3: Post-process the text
  return postProcessText(text);
}

/**
 * Extract text using multiple strategies in priority order
 */
function extractWithPriority(clonedDoc) {
  const strategies = [
    // Strategy 1: <article> tag
    () => extractFromTag(clonedDoc, 'article'),
    
    // Strategy 2: <main> tag
    () => extractFromTag(clonedDoc, 'main'),
    
    // Strategy 3: role="main"
    () => extractFromSelector(clonedDoc, '[role="main"]'),
    
    // Strategy 4: Schema.org Article
    () => extractFromSchemaOrg(clonedDoc),
    
    // Strategy 5: OpenGraph article content
    () => extractFromOpenGraph(clonedDoc),
    
    // Strategy 6: Common article selectors
    () => extractFromSelectors(clonedDoc, [
      '.article-content',
      '.article-body',
      '.post-content',
      '.entry-content',
      '.story-content',
      '.content',
      '#content',
      '.main-content',
      '.post-body',
      '.article-text'
    ]),
    
    // Strategy 7: Readability-style extraction (paragraphs)
    () => extractFromParagraphs(clonedDoc)
  ];
  
  // Try each strategy until we get good content
  for (const strategy of strategies) {
    const text = strategy();
    if (text && text.length > 300) {
      return text;
    }
  }
  
  // Fallback: Extract all meaningful text
  return extractAllText(clonedDoc);
}

/**
 * Extract text from a specific tag
 */
function extractFromTag(clonedDoc, tagName) {
  const element = clonedDoc.querySelector(tagName);
  if (!element) return "";
  
  const text = extractTextFromElement(element);
  return text.length > 300 ? text : "";
}

/**
 * Extract text from a CSS selector
 */
function extractFromSelector(clonedDoc, selector) {
  const element = clonedDoc.querySelector(selector);
  if (!element) return "";
  
  const text = extractTextFromElement(element);
  return text.length > 300 ? text : "";
}

/**
 * Extract from Schema.org Article markup
 */
function extractFromSchemaOrg(clonedDoc) {
  // Look for schema.org Article type
  const article = clonedDoc.querySelector('[itemtype*="schema.org/Article"]');
  if (!article) return "";
  
  // Try to get article body
  const body = article.querySelector('[itemprop="articleBody"]') || article;
  const text = extractTextFromElement(body);
  
  return text.length > 300 ? text : "";
}

/**
 * Extract from OpenGraph meta tags
 */
function extractFromOpenGraph(clonedDoc) {
  // This is a fallback - OpenGraph content is usually in meta tags
  // which we can't easily clone, so we return empty
  return "";
}

/**
 * Extract from multiple selectors
 */
function extractFromSelectors(clonedDoc, selectors) {
  for (const selector of selectors) {
    const text = extractFromSelector(clonedDoc, selector);
    if (text) return text;
  }
  return "";
}

/**
 * Extract from paragraphs (Readability-style)
 */
function extractFromParagraphs(clonedDoc) {
  const paragraphs = clonedDoc.querySelectorAll('p');
  
  if (paragraphs.length < 3) return "";
  
  const textParts = [];
  
  paragraphs.forEach(p => {
    const text = p.textContent.trim();
    
    // Filter criteria
    if (isTooShort(text, 40)) return;
    if (isNoiseText(text)) return;
    
    textParts.push(text);
  });
  
  if (textParts.length < 3) return "";
  
  return textParts.join("\n\n");
}

/**
 * Extract all text as last resort
 */
function extractAllText(clonedDoc) {
  const text = extractTextFromElement(clonedDoc.body);
  return text.length > 100 ? text : "";
}

/**
 * Post-process extracted text
 */
function postProcessText(text) {
  if (!text) return "";
  
  // Split into paragraphs
  const paragraphs = text.split('\n\n');
  
  // Remove duplicates and noise
  const seenTexts = new Set();
  const uniqueParagraphs = [];
  
  paragraphs.forEach(para => {
    const trimmed = para.trim();
    
    // Skip if too short
    if (isTooShort(trimmed, 40)) return;
    
    // Skip if noise
    if (isNoiseText(trimmed)) return;
    
    // Skip if duplicate
    if (isDuplicate(trimmed, seenTexts)) return;
    
    // Add to results
    seenTexts.add(trimmed.toLowerCase());
    uniqueParagraphs.push(trimmed);
  });
  
  // Join back with paragraph spacing
  return uniqueParagraphs.join('\n\n');
}

// ==================== MESSAGE LISTENER ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_ARTICLE_TEXT") {
    try {
      const text = getArticleText();
      
      sendResponse({
        success: true,
        text: text
      });
      
    } catch (err) {
      console.error("Error extracting article text:", err);
      
      sendResponse({
        success: false,
        text: "",
        error: err.message
      });
    }
    
    return true; // Keep message channel open for async response
  }
});