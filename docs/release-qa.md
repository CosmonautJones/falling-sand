# Alcubemy release package QA

Date: 2026-09-10. Branch: `codex/living-retort`, based on `2d08489`.
Historical package record: local implementation and checks completed September 10, with native/device checks still open. The September 17 deployment update below supersedes the original hosting status. Git and CI provide commit and remote status.

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

## Original publication checklist (September 10)

- Verify a real desktop tab switch and OS minimize/restore suspend work, cancel held painting and preserve manual pause. Do not infer this from the injected-event check.
- Run on a physical touch device, including rotation, material/tool scrolling and Codex close. Emulation does not certify mobile Safari or thermal/memory behavior.
- Choose the production origin. Set absolute `og:image` / `twitter:image` URLs and a canonical URL for that origin; verify the share crawler can fetch the image.
- Serve `dist/` at the host root over HTTPS. Verify all assets, reload, controls, console and share metadata at the deployed URL. No offline service worker is included.
- Use **experimental sandbox** in the portfolio entry. Use the actual deployed URL only after its smoke check. Do not claim RTX, anti-gravity, saved worlds or living construction.
- Require exact-commit CI and deployment evidence before describing the package as released. This branch has not been merged or deployed by this packaging task.

Local screenshots and automation logs are kept under ignored `qa-shots/`; the README artwork is tracked under `docs/assets/` and `public/`.

## Experimental deployment update: September 17

- The opening-scene revision `a18d5f2` passed exact-commit GitHub CI (run `34483460598`). Its production build passed locally, with the existing 557.10 kB / 145.92 kB gzip bundle warning.
- A fresh 30-second, 480 × 270 opening observation advanced from beat 3 to 1804. Four mites remained four, mud remained seven, and nursery cells `(131,264)` and `(132,264)` remained mud. The HUD showed approximately 60 fps. Local screenshot: `qa-shots/release-2026-09-17-opening-30s.png`. This is one observed opening, not a guarantee of long-term morphology.
- A clean tracked-source export was deployed to the separate Netlify project `alcubemy`. Deploy `6aabd41bb61a4e15defe3b9b` reached `ready`; its immutable HTTPS URL returned 200. The custom domain was attached and HTTPS enforcement enabled. See [deployment](deployment.md) for identifiers and update procedure.
- Retrying the native visibility check with CDP focus emulation disabled still left `document.hidden` false. It did not establish OS/native tab suspension; the prior injected-event and scheduler tests remain the available evidence.
- Physical-phone testing is still pending. Desktop and mobile emulation are described above. The public release remains explicitly experimental while these checks are open.
- The live-origin metadata now has regression coverage for canonical, Open Graph URL and absolute share-image URLs. Final deployment and portfolio checks are recorded in the release commit's task report.

## Phone and portfolio polish: September 17

- Added one-finger Move view mode, centered zoom buttons, whole-vessel fit, safe-area spacing and 44-pixel phone targets. Portrait controls wrap below the vessel and scroll vertically; landscape uses a scrollable side panel. This supersedes the earlier horizontal-row layout description.
- Try water + lava selects water and focuses the existing cup. It does not reset or alter the world. Selecting a material exits Move view. Camera fitting on resize preserves every grain.
- `scripts/mobile-qa.cjs` checked real Chromium touch dispatch at 390 × 844, 375 × 667, 844 × 390 and 667 × 375. No horizontal overflow; canvas stayed inside the viewport; toolbar targets were at least 44 × 44 pixels; Codex opened and closed. Panning preserved all cells, painting changed cells, cancellation stopped painting, and rotation preserved all cells. The opening invitation produced 44 obsidian grains and a peak of 12 steam grains in this sample. Steam is sampled during the reaction because it can disappear before a final snapshot.
- The touch harness spaces gesture events to allow Chromium's gesture recognizer to finish. Instantaneous mixed CDP/Playwright gestures intermittently suppressed the next tap. An initial shared-browser attempt also inherited 90% desktop zoom and was discarded; recorded results use an isolated browser context.
- Separate desktop WebKit 18.5 emulation passed portrait/landscape controls, invitation, material selection, camera fit and Codex open/close with no page errors. This is not physical iPhone or current mobile Safari certification. Actual device rotation, browser chrome, safe areas, heat and sustained performance still need device testing.
- Game validation: 199 tests in 14 files passed; lint, TypeScript and production build passed. Existing bundle warning remains: 558.33 kB JavaScript, 146.25 kB gzip. Simulation rules and seed vessel are unchanged.
- Portfolio preview: eight silent seconds captured from the actual renderer in a deliberately composed glass bowl, with water poured into lava. The 960 × 540 H.264 MP4 is about 184 KiB, uses fast-start metadata, and loads only on requested playback (`preload="none"`, no autoplay, inline controls). It is a composed experiment, not the opening vessel. The portfolio puts Alcubemy first in Playground.

To repeat the interaction check, run Vite on port 5179 and use `node scripts/mobile-qa.cjs` with Playwright and Chrome installed. `PLAYWRIGHT_MODULE` may point to an existing Playwright module; `QA_URL` overrides the Vite URL and `QA_CHANNEL` overrides Chrome. The harness intercepts the development module to inspect state; no test globals are shipped in the build. Screenshots stay under ignored `qa-shots/`.
