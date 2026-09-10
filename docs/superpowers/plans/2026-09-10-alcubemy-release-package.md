# Alcubemy Release Package Implementation Plan

**Goal:** Prepare approved branding, background suspension, launch checks and a visual README. Hosting and portfolio publication are not claimed by this package.

**Architecture:** Keep the grid and Three.js presentation. Extract the visible-frame scheduler for focused lifecycle tests. Use static brand assets and real gameplay captures. Keep the repository URL and historical notes intact.

**Tech stack:** TypeScript, Vitest, Vite, Three.js, SVG/PNG, Mermaid.

1. Write failing visibility-scheduler and brand/metadata tests.
2. Wire background suspension to gesture cancellation and fresh frame timing, preserving manual pause. Rename page, manifest and package; create favicon and launch icons.
3. Check desktop controls and mobile launch/layout sequentially. Verify hidden-tab suspension in the browser. Fix observed launch defects within scope.
4. Capture real artwork/motion and a share card. Rewrite README with experiments, controls, architecture diagram, startup instructions and honest roadmap boundaries.
5. Run focused checks, then the full suite with one worker, lint and build. Record browser coverage and stop preview processes.

## Status

Local implementation and verification complete. 195 tests passed with one worker; lint, type checking and production build passed. Production preview checked desktop, portrait and landscape layout and asset delivery. See [release QA](../../release-qa.md) for measured behavior, the injected visibility check and remaining physical-device/native-tab checks. Git and CI provide commit and remote status. No public deployment performed.
