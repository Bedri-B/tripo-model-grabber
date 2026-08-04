const MODEL_EXT_RE = /\.(glb|gltf|fbx|obj|usdz|stl|zip)(?:$|\?)/i;
const MODEL_CONTENT_TYPES = new Set([
  "model/gltf-binary",
  "model/gltf+json",
  "model/obj",
  "model/stl",
]);
const MAX_ENTRIES = 200;

function filenameFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    return decodeURIComponent(parts[parts.length - 1]) || "model";
  } catch {
    return "model";
  }
}

function keyFromUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

function pageKeyFromUrl(url, tabId) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return tabId != null && tabId >= 0 ? `tab:${tabId}` : "unknown";
  }
}

async function getTabInfo(tabId) {
  if (tabId == null || tabId < 0) return null;
  try {
    const tab = await chrome.tabs.get(tabId);
    return { title: tab.title || "", url: tab.url || "", windowId: tab.windowId };
  } catch {
    return null;
  }
}

function updateBadge(models) {
  const pending = models.filter((m) => !m.downloaded).length;
  chrome.action.setBadgeText({ text: pending ? String(pending) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
}

async function addCapturedModel(entry) {
  const { models = [] } = await chrome.storage.session.get("models");
  const key = keyFromUrl(entry.url);
  const idx = models.findIndex((m) => keyFromUrl(m.url) === key);
  if (idx >= 0) {
    // Refresh the (possibly re-signed) URL/metadata but keep download status.
    models[idx] = {
      ...entry,
      downloaded: models[idx].downloaded,
      downloadedAt: models[idx].downloadedAt,
    };
  } else {
    models.unshift(entry);
  }
  if (models.length > MAX_ENTRIES) models.length = MAX_ENTRIES;
  await chrome.storage.session.set({ models });
  updateBadge(models);
}

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    if (details.method !== "GET" || details.statusCode >= 400) return;

    const urlNoQuery = details.url.split("?")[0];
    const headers = details.responseHeaders || [];
    const contentType = (
      headers.find((h) => h.name.toLowerCase() === "content-type")?.value || ""
    ).split(";")[0].trim().toLowerCase();

    const isModel =
      MODEL_EXT_RE.test(urlNoQuery) || MODEL_CONTENT_TYPES.has(contentType);
    if (!isModel) return;

    const lengthHeader = headers.find(
      (h) => h.name.toLowerCase() === "content-length"
    );

    const tabInfo = await getTabInfo(details.tabId);
    const pageUrl = tabInfo?.url || details.initiator || "";

    await addCapturedModel({
      url: details.url,
      filename: filenameFromUrl(details.url),
      size: lengthHeader ? parseInt(lengthHeader.value, 10) : null,
      tabId: details.tabId,
      windowId: tabInfo?.windowId ?? null,
      pageUrl,
      pageTitle: tabInfo?.title || "",
      pageKey: pageKeyFromUrl(pageUrl, details.tabId),
      capturedAt: Date.now(),
      downloaded: false,
      downloadedAt: null,
    });
  },
  { urls: ["https://*.tripo3d.ai/*", "https://*.tripo3d.com/*"] },
  ["responseHeaders"]
);

chrome.runtime.onInstalled.addListener(async () => {
  const { models = [] } = await chrome.storage.session.get("models");
  updateBadge(models);
});

chrome.runtime.onStartup.addListener(async () => {
  const { models = [] } = await chrome.storage.session.get("models");
  updateBadge(models);
});
