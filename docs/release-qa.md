# Alcubemy release package QA

Date: 2026-09-10. Branch: `codex/living-retort`, based on `2d08489`.
Status: local implementation and checks complete, with the native/device gates below still open. Public deployment is not verified. This record describes package validation; Git and CI provide commit and remote status.

## Automated checks

- `npm test -- --maxWorkers=1 --minWorkers=1`: 195 tests in 14 files passed, 146.12 seconds.
- `npm run lint`: passed with no warnings.
- `npm run build`: TypeScript check and Vite production build passed. Existing bundle-size warning remains: 557.02 kB JavaScript, 145.89 kB gzip.
- `git diff --check`: passed. Launch PNG dimensions verified directly from their headers.

## Scope

Alcubemy name, experimental-sandbox positioning, SVG favicon, 192/512-pixel install icons, 180-pixel Apple icon, 1200 × 630 share card, visibility-aware frame scheduling and small-screen controls. Simulation rules are unchanged. Living construction remains on the roadmap.

The share card is composed from an actual renderer capture at the prior optics revision. Its HTML source is `docs/assets/share-card.html`; its screenshot source is `docs/assets/material-study.png`. It illustrates a deliberately composed scene, not the opening vessel. Serve the repository with Vite and capture the card at 1200 × 630 to regenerate `public/share.png`. The PNG icons are browser renders of `public/icon.svg` at their named sizes (Apple: 180 × 180).

## Browser evidence

Chromium automation on Windows, checks run sequentially because system RAM was nearly exhausted. A second graphics context stalled capture, so it was closed. No memory-usage improvement or universal frame-rate guarantee is claimed.

- Desktop input: left drag painted 581 stone cells; right-click identified stone; wheel zoom reached 3.32×; right drag changed pan by (60, 30); double-click restored zoom to 1.
- Emulated touch: a touch hold and drag painted 750 sand cells on a paused empty grid. At 390 × 844, no horizontal document overflow; material buttons measured 44 pixels high. Touch instructions appeared with coarse-pointer emulation. Mobile rows scroll to reach further materials and tools.
- Production preview: checked 1440 × 1000 desktop, 390 × 844 portrait and 844 × 390 landscape. Canvas bounds stayed inside each viewport, with no horizontal document overflow. Codex opened and closed on desktop and landscape. SVG, all three PNG launch icons, share image and manifest returned HTTP 200 with the expected content types. Screenshots were visually inspected; portrait retains a small, wide vessel because the simulation remains 480 × 270.
- No JavaScript errors were reported during production launch. Existing AudioContext autoplay warnings occur before a user gesture; audio readiness is not claimed before interaction. Preview and QA browser were stopped after checks.
- A 30-second hands-off opening run advanced from beat 1 to 1802, retained four mites and showed approximately 60 fps. This is an observed sample, not a performance promise or proof of completed colony construction.
- Visibility integration used an injected `document.hidden` value plus `visibilitychange` against the real application. While hidden for 1.2 seconds, beats stayed 1336 and draw calls stayed 1275. The first visible frame drew once without stepping; simulation then resumed. Manual pause preserved beat 1343 across hide/show while presentation resumed.
- Native tab switching and a CDP minimize request in this automation setup kept `document.hidden === false`. They therefore did **not** verify native visibility delivery. Scheduler unit tests cover hidden startup, cancellation, stale callbacks, duplicate events and disposal.

## Before public publication

- Verify a real desktop tab switch and OS minimize/restore suspend work, cancel held painting and preserve manual pause. Do not infer this from the injected-event check.
- Run on a physical touch device, including rotation, material/tool scrolling and Codex close. Emulation does not certify mobile Safari or thermal/memory behavior.
- Choose the production origin. Set absolute `og:image` / `twitter:image` URLs and a canonical URL for that origin; verify the share crawler can fetch the image.
- Serve `dist/` at the host root over HTTPS. Verify all assets, reload, controls, console and share metadata at the deployed URL. No offline service worker is included.
- Use **experimental sandbox** in the portfolio entry. Use the actual deployed URL only after its smoke check. Do not claim RTX, anti-gravity, saved worlds or living construction.
- Require exact-commit CI and deployment evidence before describing the package as released. This branch has not been merged or deployed by this packaging task.

Local screenshots and automation logs are kept under ignored `qa-shots/`; the README artwork is tracked under `docs/assets/` and `public/`.
