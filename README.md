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
2. Click the extension icon — the badge shows how many *new, undownloaded*
   model files have been captured.
3. Entries are grouped by the page/tab they came from. Click a group's
   title to jump back to that tab; click **Download N new** to grab
   everything pending in that group, or download entries one at a time.
4. Once a file is downloaded it's marked **Downloaded ✓** and dims out
   (it stays in the list for reference, and no longer counts toward the
   badge) — click it again any time to re-download.
5. Files save under your Downloads folder as
   `Tripo3D/<page name>/<page name> (part N).ext`, using the browser
   tab's title as the display name. If the tab title isn't descriptive
   (e.g. Tripo3D didn't update it for that project), it falls back to the
   original CDN filename.

Signed URLs expire after a while. Rather than only finding out when a
download fails, the extension decodes the expiry embedded in the CDN URL's
`Policy` parameter (standard CloudFront signed-URL format) and shows
"expires in Xm" next to pending entries, switching to a disabled "Expired"
state once the link has actually lapsed — so expired links no longer count
toward the badge either. If a link does expire before you download it,
reload/reopen the model on the site to capture a fresh one. This decoding
is defensive: if Tripo's CDN URLs ever stop matching the expected format,
it silently falls back to no countdown rather than breaking anything.

## Notes

- This only touches files loaded during your own normal browsing/generation
  in your own account — it doesn't call any private API directly.
- Captured entries (including download status and source page) are kept in
  `chrome.storage.session` (cleared when the browser fully closes), since
  signed links wouldn't survive a restart anyway.
- Tab title/URL is read via `chrome.tabs.get()`, which only returns that
  data for tabs the extension already has host permission for — no extra
  `tabs` permission needed.
