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

let statusTimer = null;
function showStatus(message) {
  const el = document.getElementById("status");
  el.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    el.textContent = "";
  }, 5000);
}

function downloadModel(m) {
  chrome.downloads.download(
    {
      url: m.url,
      filename: `Tripo3D/${m.filename}`,
      saveAs: false,
    },
    (downloadId) => {
      if (chrome.runtime.lastError || downloadId === undefined) {
        showStatus(
          `Couldn't download ${m.filename} — the link may have expired. Reopen the model on studio.tripo3d.ai to refresh it.`
        );
      }
    }
  );
}

async function render() {
  const { models = [] } = await chrome.storage.session.get("models");
  const list = document.getElementById("list");
  const empty = document.getElementById("empty");

  list.textContent = "";

  if (!models.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const m of models) {
    const li = document.createElement("li");

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
    btn.textContent = "Download";
    btn.addEventListener("click", () => downloadModel(m));

    li.appendChild(info);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

document.getElementById("downloadAll").addEventListener("click", async () => {
  const { models = [] } = await chrome.storage.session.get("models");
  for (const m of models) downloadModel(m);
});

document.getElementById("clear").addEventListener("click", async () => {
  await chrome.storage.session.set({ models: [] });
  chrome.action.setBadgeText({ text: "" });
  render();
});

render();
