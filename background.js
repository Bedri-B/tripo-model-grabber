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

// Mirrors popup.js's getUrlExpiry/isExpired — see there for why: CloudFront
// signed URLs carry their own expiry in the `Policy` query param.
function getUrlExpiry(url) {
  try {
    const u = new URL(url);
    const policy = u.searchParams.get("Policy");
    if (!policy) return null;
    const std = policy.replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/");
    const data = JSON.parse(atob(std));
    const epoch = data?.Statement?.[0]?.Condition?.DateLessThan?.["AWS:EpochTime"];
    return typeof epoch === "number" ? epoch * 1000 : null;
  } catch {
    return null;
  }
}

function isActionable(m) {
  if (m.downloaded) return false;
  const inFlight = !m.downloadError && m.downloadId != null;
  if (inFlight) return false;
  const expiresAt = getUrlExpiry(m.url);
  return expiresAt == null || Date.now() <= expiresAt;
}

// Chrome's downloads.download() callback only reports *synchronous* queueing
// failures. Whether a download actually succeeds or gets rejected by the
// server happens later and is reported here — this is what resolves a
// "downloading…" entry to a confirmed "Downloaded" or a real error reason,
// instead of guessing based on signed-URL expiry alone.
const INTERRUPT_REASONS = {
  SERVER_FORBIDDEN: "server rejected the request (403 Forbidden)",
  SERVER_BAD_CONTENT: "file no longer exists on the server (404)",
  NETWORK_FAILED: "network error",
  NETWORK_TIMEOUT: "network timeout",
  USER_CANCELED: "canceled",
  FILE_ACCESS_DENIED: "couldn't write the file (check folder permissions)",
};

function describeInterruptReason(reason) {
  return INTERRUPT_REASONS[reason] || reason || "unknown error";
}

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.state) return;
  const { models = [] } = await chrome.storage.session.get("models");
  const idx = models.findIndex((m) => m.downloadId === delta.id);
  if (idx < 0) return;

  if (delta.state.current === "complete") {
    models[idx].downloaded = true;
    models[idx].downloadedAt = Date.now();
    models[idx].downloadError = null;
  } else if (delta.state.current === "interrupted") {
    models[idx].downloadError = describeInterruptReason(delta.error?.current);
  } else {
    return; // "in_progress" — nothing resolved yet
  }

  await chrome.storage.session.set({ models });
  updateBadge(models);
});

function updateBadge(models) {
  const pending = models.filter((m) => isActionable(m)).length;
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
      downloadId: null,
      downloadError: null,
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
