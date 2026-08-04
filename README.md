# Tripo3D Model Grabber

Chrome (MV3) extension that watches network traffic on `studio.tripo3d.ai` /
`*.tripo3d.com` and lists any 3D model file it sees load (`.glb`, `.gltf`,
`.fbx`, `.obj`, `.usdz`, `.stl`, `.zip`), so you can download it with one
click from the popup.

## Why this approach

The provided HAR capture (`studio.tripo3d.ai.har`) only covered a page load /
generation session — it didn't include a click on Tripo's own "Download /
Export" button, so the private REST endpoint that issues a final export link
was never observed. Instead of guessing that endpoint (which would break the
moment Tripo changes their backend), this extension passively watches
`chrome.webRequest` for any response that looks like a 3D model file. That
covers the export flow too, since clicking "Download" still has to result in
your browser fetching a model file over the network — this just catches it
as it happens.

One confirmed example from the HAR: models are served from
`tripo-data.rg1.data.tripo3d.com` via CloudFront-signed URLs
(`Key-Pair-Id` / `Policy` / `Signature` query params) with no cookie/auth
header required — so `chrome.downloads.download()` can fetch them directly
as long as the signed URL hasn't expired yet.

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder: `C:\Users\hp\Projects\Claude\TripoModelGrabber`

## Use

1. Browse to `studio.tripo3d.ai` and open/generate/view a model as normal.
2. Click the extension icon — the badge shows how many model files have
   been captured.
3. Click **Download** next to any entry, or **Download All**.
4. Files save under your Downloads folder in a `Tripo3D/` subfolder.

Signed URLs expire after a while, so download soon after an entry appears —
if a download fails, just reload/reopen the model in the site to re-trigger
the fetch and capture a fresh link.

## Notes

- This only touches files loaded during your own normal browsing/generation
  in your own account — it doesn't call any private API directly.
- Captured entries are kept in `chrome.storage.session` (cleared when the
  browser fully closes), since signed links wouldn't survive a restart
  anyway.
