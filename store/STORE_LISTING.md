# Chrome Web Store listing copy

Paste these directly into the Developer Dashboard fields when you submit.

## Product name (max 75 chars)
Model Grabber for Tripo3D

## Summary / short description (max 132 chars)
Catches .glb/.gltf/.fbx/.obj/.usdz files as they load on studio.tripo3d.ai so you can save your generated models in one click.

## Detailed description

Model Grabber for Tripo3D is a small utility that watches for 3D model
files (.glb, .gltf, .fbx, .obj, .usdz, .stl) while you use Tripo3D's
studio, and lists them in a popup so you can save them to disk without
digging through DevTools or guessing at export options.

How it works:
- While you generate, preview, or export a model on studio.tripo3d.ai,
  your browser loads the underlying model file(s) over the network.
- This extension watches for those file loads (by extension and content
  type) and adds each one to a simple list in its popup, with file size
  and how long ago it was seen.
- Click "Download" on any entry (or "Download All") to save it straight
  to a Tripo3D folder in your Downloads.

Notes:
- Everything runs locally in your browser. No data is collected, stored
  remotely, or sent to any server other than the download request itself
  going to Tripo3D's own file host.
- Captured links can expire (they're short-lived signed URLs), so
  download soon after an entry appears. If a download fails, reopening
  the model on the site refreshes the link.
- This is an independent, community-built tool. It is not affiliated
  with, endorsed by, or built in partnership with Tripo3D. Use it to
  manage models generated under your own account, subject to Tripo3D's
  own Terms of Service.

## Category
Productivity (alt: Developer Tools)

## Language
English

## Single purpose description (for the "Privacy practices" tab)
This extension's single purpose is to detect 3D model files (glb, gltf,
fbx, obj, usdz, stl) loading in the browser on Tripo3D's website and let
the user download them via the standard Chrome downloads UI.

## Permission justifications

- **webRequest** — required to observe network responses and detect when
  a 3D model file has loaded, by inspecting the URL/content-type of
  completed requests. The extension does not block, redirect, or modify
  any request.
- **downloads** — required to save a detected model file to disk when the
  user clicks "Download" in the popup.
- **storage** — required to keep the (session-only) list of detected
  model files so the popup can display them.
- **host permissions (`*.tripo3d.ai`, `*.tripo3d.com`)** — the extension
  only inspects traffic on Tripo3D's own domains; it does not run on or
  access any other site.

## Data usage disclosure
- Does not collect or transmit personally identifiable information.
- Does not collect or transmit health information, financial or payment
  information, authentication information, personal communications,
  location, web history, or user activity, to any party.
- All detected-file metadata (URL, filename, size, timestamp) stays in
  local, session-scoped `chrome.storage` and is never sent off-device
  except as part of the download request itself (to Tripo3D's CDN, the
  same place the browser would fetch it from anyway).

## Privacy policy URL
Host `PRIVACY_POLICY.md` (or the rendered equivalent) somewhere public —
e.g. a GitHub Pages page or raw GitHub URL — and paste that link into the
"Privacy policy URL" field. The Chrome Web Store requires this field to
be filled in for listings that request host permissions.
