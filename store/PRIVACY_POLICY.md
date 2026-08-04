# Privacy Policy — Model Grabber for Tripo3D

_Last updated: 2026-08-04_

Model Grabber for Tripo3D ("the extension") is a browser tool that helps
you save 3D model files you generate on studio.tripo3d.ai. This policy
explains what data the extension touches and what it does with it.

## What the extension does

While a tab is open on `*.tripo3d.ai` or `*.tripo3d.com`, the extension
observes network responses in that tab to detect when a 3D model file
(`.glb`, `.gltf`, `.fbx`, `.obj`, `.usdz`, `.stl`) has loaded. When one is
detected, the extension records:

- the file's URL
- its filename
- its size (if reported by the server)
- the time it was detected

This information is stored only in `chrome.storage.session` — an
in-memory store that is cleared automatically when you close your
browser. It is never written to disk by the extension, never sent to any
server operated by us, and never shared with any third party.

## What the extension does not do

- It does not collect browsing history outside of `tripo3d.ai` /
  `tripo3d.com`.
- It does not collect personal information, account credentials, payment
  information, or authentication tokens.
- It does not use analytics, telemetry, or crash reporting.
- It does not run any code on, or observe traffic from, any site other
  than the domains listed above.

## Downloads

When you click "Download" in the popup, the extension asks Chrome's
built-in downloads API to save the previously detected file URL to your
computer, the same way a normal browser download works. That request
goes directly from your browser to Tripo3D's file host — it does not
pass through any server we operate.

## Changes

If this policy changes, the updated version will be posted at this same
location with a new "Last updated" date.

## Contact

Questions about this policy or the extension can be sent to:
`info@boingo.ai`
