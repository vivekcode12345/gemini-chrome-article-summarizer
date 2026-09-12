import { AI_PROVIDERS, getProvider, getSummaryFromProvider } from "./providers.js";

async function getSettingsWithFallback(keys) {
  const syncRes = await new Promise((resolve) => {
    try {
      chrome.storage.sync.get(keys, (r) => resolve(r || {}));
    } catch (e) {
      resolve({});
    }
  });
  if (keys.some((k) => syncRes?.[k])) return syncRes;
  try {
    const localRes = await new Promise((resolve) => {
      chrome.storage.local.get(keys, (r) => resolve(r || {}));
    });
    return { ...(localRes || {}), ...(syncRes || {}) };
  } catch (e) {
    return syncRes || {};
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const result = await getSettingsWithFallback(["geminiApiKey", "openaiApiKey", "anthropicApiKey", "aiProvider"]);
  const hasKey = !!(result.geminiApiKey || result.openaiApiKey || result.anthropicApiKey);
  if (!hasKey) {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "PING") {
    sendResponse({ status: "OK" });
    return true;
  }
  if (request.type === "OPEN_POPUP") {
    (async () => {
      try {
        if (chrome.action?.openPopup) {
          await chrome.action.openPopup();
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false, error: "openPopup not available" });
        }
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "summarize-page") return;

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) return;

  if (
    tab.url &&
    (tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:"))
  ) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "AI Article Summary",
      message: "Cannot summarize browser internal pages.",
    });
    return;
  }

  let articleText = "";
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_ARTICLE_TEXT" });
    if (response?.success && response.text && response.text.length >= 100) {
      articleText = response.text;
    }
  } catch {
    // content script not injected yet
  }

  if (!articleText) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_ARTICLE_TEXT" });
      if (response?.success && response.text && response.text.length >= 100) {
        articleText = response.text;
      }
    } catch {
      // ignore injection failures
    }
  }

  if (!articleText) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "AI Article Summary",
      message: "Could not extract article text from this page.",
    });
    return;
  }

  const storage = await getSettingsWithFallback(["aiProvider", "geminiApiKey", "openaiApiKey", "anthropicApiKey", "defaultLanguage"]);
  const providerId = storage.aiProvider || "gemini";
  const provider = AI_PROVIDERS[providerId];
  if (!provider) return;

  const apiKey = storage[provider.apiKeyStorageKey];
  if (!apiKey) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "AI Article Summary",
      message: "Please configure your API key in Settings.",
    });
    return;
  }

  try {
    const text = await getSummaryFromProvider(articleText, "brief", providerId, apiKey, storage.defaultLanguage || "en");
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text;
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: `AI Summary (${provider.label})`,
      message: `${words} words — ${truncated}`,
    });
  } catch (error) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "AI Article Summary",
      message: error.message || "Failed to generate summary.",
    });
  }
});
