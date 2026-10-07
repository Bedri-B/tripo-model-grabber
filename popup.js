function formatSize(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}

function formatTimeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function formatCountdown(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

// Tripo's CDN serves models via CloudFront-signed URLs that carry their own
// expiry inside the `Policy` query param. Decoding it lets us warn before a
// download attempt fails, instead of only finding out after the fact.
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

function isExpired(m) {
  const expiresAt = getUrlExpiry(m.url);
  return expiresAt != null && Date.now() > expiresAt;
}

function isInFlight(m) {
  return !m.downloaded && !m.downloadError && m.downloadId != null;
}

function isActionable(m) {
  return !m.downloaded && !isExpired(m) && !isInFlight(m);
}

const RESERVED_WINDOWS_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

function sanitizeFilename(name) {
  // Spread to iterate by Unicode codepoint, not UTF-16 code unit, so a
  // later length-cap can't split a surrogate pair and leave a lone
  // (invalid) surrogate in the result.
  const codepoints = [...name].filter((ch) => {
    const code = ch.codePointAt(0);
    if (code <= 0x1f || code === 0x7f) return false;
    if ('<>:"/\\|?*'.includes(ch)) return false;
    return true;
  });

  let out = codepoints.join("").replace(/\s+/g, " ").trim();
  out = [...out].slice(0, 80).join("");
  out = out.replace(/[\s.]+$/, ""); // Windows rejects trailing dots/spaces
  if (RESERVED_WINDOWS_NAMES.test(out)) out += "_";
  return out;
}

// Strips a trailing " - Tripo3D Studio" / " | Tripo3D" style site suffix, if present.
function cleanPageTitle(title) {
  if (!title) return "";
  return title.replace(/\s*[-|·–]\s*Tripo(3D)?[^-|·–]*$/i, "").trim();
}

function fileExt(filename) {
  const m = filename.match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : "glb";
}

function partLabel(filename) {
  const m = filename.match(/part[_-]?(\d+)/i);
  return m ? `part ${m[1]}` : "";
}

function pageDisplayName(m) {
  return cleanPageTitle(m.pageTitle) || m.filename || "Unknown page";
}

// Builds a Downloads-relative path using the page's title so files are easy
// to identify, grouped per page/project. Falls back to the original CDN
// filename when no usable page title was captured.
function buildDownloadPath(m) {
  const ext = fileExt(m.filename);
  const cleaned = sanitizeFilename(cleanPageTitle(m.pageTitle));
  if (!cleaned) return safeDownloadPath(m);

  const label = partLabel(m.filename);
  const nameOnly = label ? `${cleaned} (${label})` : cleaned;
  return `Tripo3D/${cleaned}/${nameOnly}.${ext}`;
}

// The original CDN filename is already filesystem-safe (no title-derived
// text in it), so this is the guaranteed-to-work fallback path.
function safeDownloadPath(m) {
  return `Tripo3D/${m.filename}`;
}

async function getModels() {
  const { models = [] } = await chrome.storage.session.get("models");
  return models;
}

async function setModels(models) {
  await chrome.storage.session.set({ models });
  const pending = models.filter((m) => isActionable(m)).length;
  chrome.action.setBadgeText({ text: pending ? String(pending) : "" });
}

function keyOf(m) {
  try {
    const u = new URL(m.url);
    return u.origin + u.pathname;
  } catch {
    return m.url;
  }
}

let statusTimer = null;
function showStatus(message) {
  const el = document.getElementById("status");
  el.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    el.textContent = "";
  }, 5000);
}

// Records that a download was *queued* (not necessarily finished) so
// background.js's downloads.onChanged listener can later resolve it to
// "downloaded" (complete) or an error (interrupted) even if this popup
// closes before that happens.
async function recordQueuedDownload(m, downloadId) {
  const models = await getModels();
  const idx = models.findIndex((x) => keyOf(x) === keyOf(m));
  if (idx >= 0) {
    models[idx].downloadId = downloadId;
    models[idx].downloadError = null;
    await setModels(models);
  }
  render();
}

function downloadModel(m, retryWithSafeName = false) {
  const filename = retryWithSafeName ? safeDownloadPath(m) : buildDownloadPath(m);
  chrome.downloads.download(
    {
      url: m.url,
      filename,
      saveAs: false,
    },
    (downloadId) => {
      if (chrome.runtime.lastError || downloadId === undefined) {
        const reason = chrome.runtime.lastError?.message || "unknown error";

        // The title-derived filename can hit an edge case our sanitizer
        // didn't anticipate. Rather than fail outright, retry once with
        // the original CDN filename, which is always filesystem-safe.
        if (!retryWithSafeName && filename !== safeDownloadPath(m)) {
          downloadModel(m, true);
          return;
        }

        const expiryNote = isExpired(m)
          ? " This link's signed expiry has in fact passed — reopen the model on studio.tripo3d.ai to refresh it."
          : " This link isn't expired yet, so this is likely a Chrome/network issue — try again, or check chrome://downloads.";
        showStatus(`Couldn't start download for ${m.filename}: ${reason}.${expiryNote}`);
        return;
      }
      recordQueuedDownload(m, downloadId);
    }
  );
}

function openSourceTab(m) {
  if (m.tabId == null || m.tabId < 0) {
    showStatus("That tab isn't tracked (couldn't detect it when captured).");
    return;
  }
  chrome.tabs.update(m.tabId, { active: true }, () => {
    if (chrome.runtime.lastError) {
      showStatus("That tab has been closed.");
      return;
    }
    if (m.windowId != null) {
      chrome.windows.update(m.windowId, { focused: true });
    }
  });
}

function groupByPage(models) {
  const groups = new Map();
  for (const m of models) {
    const key = m.pageKey || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  // Sort groups by most recent activity, entries within a group newest-first.
  return [...groups.values()]
    .map((items) => items.sort((a, b) => b.capturedAt - a.capturedAt))
    .sort((a, b) => b[0].capturedAt - a[0].capturedAt);
}

async function render() {
  const models = await getModels();
  const list = document.getElementById("list");
  const empty = document.getElementById("empty");

  // Refresh the badge on every popup open too, since links can silently
  // expire between captures with no other event to trigger a recount.
  const pending = models.filter((m) => isActionable(m)).length;
  chrome.action.setBadgeText({ text: pending ? String(pending) : "" });

  list.textContent = "";

  if (!models.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const group of groupByPage(models)) {
    const sample = group[0];

    const section = document.createElement("div");
    section.className = "page-group";

    const header = document.createElement("div");
    header.className = "page-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "page-title-wrap";

    const dot = document.createElement("span");
    dot.className = "page-dot";

    const title = document.createElement("span");
    title.className = "page-title";
    title.textContent = pageDisplayName(sample);
    title.title = sample.pageUrl || "";
    title.addEventListener("click", () => openSourceTab(sample));

    titleWrap.appendChild(dot);
    titleWrap.appendChild(title);

    const groupBtn = document.createElement("button");
    groupBtn.type = "button";
    groupBtn.className = "group-download";
    const pendingInGroup = group.filter((m) => isActionable(m));
    const expiredUndownloaded = group.filter((m) => !m.downloaded && isExpired(m));
    if (pendingInGroup.length) {
      groupBtn.textContent = `Download ${pendingInGroup.length} new`;
    } else if (expiredUndownloaded.length) {
      groupBtn.textContent = "Links expired";
    } else {
      groupBtn.textContent = "All saved";
    }
    groupBtn.disabled = pendingInGroup.length === 0;
    groupBtn.addEventListener("click", () => {
      for (const m of pendingInGroup) downloadModel(m);
    });

    header.appendChild(titleWrap);
    header.appendChild(groupBtn);
    section.appendChild(header);

    const ul = document.createElement("ul");
    ul.className = "page-items";

    for (const m of group) {
      const li = document.createElement("li");
      const expired = !m.downloaded && isExpired(m);
      const inFlight = isInFlight(m);
      if (m.downloaded) li.classList.add("downloaded");
      if (expired) li.classList.add("expired");
      if (m.downloadError) li.classList.add("has-error");

      const info = document.createElement("div");
      info.className = "info";

      const name = document.createElement("span");
      name.className = "filename";
      name.title = m.filename;
      name.textContent = m.filename;

      const metaParts = [formatSize(m.size), formatTimeAgo(m.capturedAt)].filter(Boolean);
      if (m.downloadError) {
        metaParts.push(`failed: ${m.downloadError}`);
      } else if (inFlight) {
        metaParts.push("downloading…");
      } else if (expired) {
        metaParts.push("link expired");
      } else if (!m.downloaded) {
        const expiresAt = getUrlExpiry(m.url);
        if (expiresAt != null) {
          metaParts.push(`expires in ${formatCountdown(expiresAt - Date.now())}`);
        }
      }

      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = metaParts.join(" · ");

      info.appendChild(name);
      info.appendChild(meta);

      const btn = document.createElement("button");
      btn.type = "button";
      if (m.downloaded) {
        btn.textContent = "Downloaded ✓";
        btn.title = "Download again";
      } else if (inFlight) {
        btn.textContent = "Downloading…";
        btn.title = "Download in progress";
        btn.disabled = true;
      } else if (m.downloadError) {
        btn.textContent = "Retry";
        btn.title = m.downloadError;
      } else if (expired) {
        btn.textContent = "Expired";
        btn.title = "Reopen the model on studio.tripo3d.ai to refresh this link";
        btn.disabled = true;
      } else {
        btn.textContent = "Download";
        btn.title = "Download";
      }
      btn.addEventListener("click", () => downloadModel(m));

      li.appendChild(info);
      li.appendChild(btn);
      ul.appendChild(li);
    }

    section.appendChild(ul);
    list.appendChild(section);
  }
}

document.getElementById("downloadAll").addEventListener("click", async () => {
  const models = await getModels();
  for (const m of models.filter((x) => isActionable(x))) downloadModel(m);
});

document.getElementById("clear").addEventListener("click", async () => {
  await setModels([]);
  render();
});

// background.js resolves queued downloads to complete/interrupted via
// chrome.downloads.onChanged and writes the result to storage; re-render
// live if that happens while this popup happens to still be open.
chrome.downloads.onChanged.addListener(() => render());

render();
