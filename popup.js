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

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
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
  if (!cleaned) return `Tripo3D/${m.filename}`;

  const label = partLabel(m.filename);
  const nameOnly = label ? `${cleaned} (${label})` : cleaned;
  return `Tripo3D/${cleaned}/${nameOnly}.${ext}`;
}

async function getModels() {
  const { models = [] } = await chrome.storage.session.get("models");
  return models;
}

async function setModels(models) {
  await chrome.storage.session.set({ models });
  const pending = models.filter((m) => !m.downloaded).length;
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

async function markDownloaded(m) {
  const models = await getModels();
  const idx = models.findIndex((x) => keyOf(x) === keyOf(m));
  if (idx >= 0) {
    models[idx].downloaded = true;
    models[idx].downloadedAt = Date.now();
    await setModels(models);
  }
  render();
}

function downloadModel(m) {
  chrome.downloads.download(
    {
      url: m.url,
      filename: buildDownloadPath(m),
      saveAs: false,
    },
    (downloadId) => {
      if (chrome.runtime.lastError || downloadId === undefined) {
        showStatus(
          `Couldn't download ${m.filename} — the link may have expired. Reopen the model on studio.tripo3d.ai to refresh it.`
        );
        return;
      }
      markDownloaded(m);
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
    const pendingInGroup = group.filter((m) => !m.downloaded);
    groupBtn.textContent = pendingInGroup.length
      ? `Download ${pendingInGroup.length} new`
      : "All saved";
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
      if (m.downloaded) li.classList.add("downloaded");

      const info = document.createElement("div");
      info.className = "info";

      const name = document.createElement("span");
      name.className = "filename";
      name.title = m.filename;
      name.textContent = m.filename;

      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = [formatSize(m.size), formatTimeAgo(m.capturedAt)]
        .filter(Boolean)
        .join(" · ");

      info.appendChild(name);
      info.appendChild(meta);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = m.downloaded ? "Downloaded ✓" : "Download";
      btn.title = m.downloaded ? "Download again" : "Download";
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
  for (const m of models.filter((x) => !x.downloaded)) downloadModel(m);
});

document.getElementById("clear").addEventListener("click", async () => {
  await setModels([]);
  render();
});

render();
