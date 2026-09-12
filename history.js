const HISTORY_STORAGE_KEY = "summaryHistory";
const FAVORITES_STORAGE_KEY = "summaryFavorites";
const MAX_HISTORY_ITEMS = 100;

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getStorageKey() {
  return HISTORY_STORAGE_KEY;
}

function getFavoritesKey() {
  return FAVORITES_STORAGE_KEY;
}

export async function loadHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get([getStorageKey()], (result) => {
      resolve(Array.isArray(result[getStorageKey()]) ? result[getStorageKey()] : []);
    });
  });
}

export async function loadFavorites() {
  return new Promise((resolve) => {
    chrome.storage.local.get([getFavoritesKey()], (result) => {
      resolve(Array.isArray(result[getFavoritesKey()]) ? result[getFavoritesKey()] : []);
    });
  });
}

export async function saveHistoryItem({ url, title, summary, mode, providerLabel, language, tabs }) {
  const history = await loadHistory();
  const favorites = await loadFavorites();
  const item = {
    id: generateId(),
    url: url || "",
    title: title || "Untitled",
    summary: typeof summary === "string" ? summary : "",
    mode: mode || "brief",
    providerLabel: providerLabel || "",
    language: language || "en",
    tabs: Array.isArray(tabs) ? tabs : undefined,
    createdAt: Date.now(),
    isFavorite: favorites.some((fav) => fav.url === (url || "") && fav.summary === summary),
  };

  const next = [item, ...history].slice(0, MAX_HISTORY_ITEMS);

  return new Promise((resolve) => {
    chrome.storage.local.set({ [getStorageKey()]: next }, () => {
      resolve(item);
    });
  });
}

export async function toggleFavorite(itemId) {
  const history = await loadHistory();
  const index = history.findIndex((item) => item.id === itemId);
  if (index === -1) return;

  const updatedItem = { ...history[index], isFavorite: !history[index].isFavorite };
  history[index] = updatedItem;

  let favorites = await loadFavorites();
  if (updatedItem.isFavorite) {
    favorites = favorites.filter((fav) => fav.id !== itemId);
    favorites.unshift({
      id: updatedItem.id,
      url: updatedItem.url,
      title: updatedItem.title,
      summary: updatedItem.summary,
      mode: updatedItem.mode,
      providerLabel: updatedItem.providerLabel,
      language: updatedItem.language || "en",
      tabs: updatedItem.tabs,
      createdAt: updatedItem.createdAt,
    });
  } else {
    favorites = favorites.filter((fav) => fav.id !== itemId);
  }

  await Promise.all([
    new Promise((resolve) => {
      chrome.storage.local.set({ [getStorageKey()]: history }, resolve);
    }),
    new Promise((resolve) => {
      chrome.storage.local.set({ [getFavoritesKey()]: favorites }, resolve);
    }),
  ]);

  return updatedItem;
}

export async function deleteHistoryItem(itemId) {
  const history = await loadHistory();
  const next = history.filter((item) => item.id !== itemId);
  const favorites = await loadFavorites();
  const nextFavorites = favorites.filter((fav) => fav.id !== itemId);

  await Promise.all([
    new Promise((resolve) => {
      chrome.storage.local.set({ [getStorageKey()]: next }, resolve);
    }),
    new Promise((resolve) => {
      chrome.storage.local.set({ [getFavoritesKey()]: nextFavorites }, resolve);
    }),
  ]);
}

export async function clearHistory() {
  await Promise.all([
    new Promise((resolve) => {
      chrome.storage.local.set({ [getStorageKey()]: [] }, resolve);
    }),
    new Promise((resolve) => {
      chrome.storage.local.set({ [getFavoritesKey()]: [] }, resolve);
    }),
  ]);
}
