/* Theme preload — classic script (not a module) so it runs synchronously
 * from <head> before first paint. Reads the localStorage mirror written by
 * popup.js / options.js and applies data-theme early to avoid a flash.
 * No chrome.* APIs here on purpose: localStorage is synchronous. */
(function () {
  try {
    var saved = localStorage.getItem("ai-summarizer-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch (e) {
    /* storage unavailable — fall back to system preference via CSS */
  }
})();
