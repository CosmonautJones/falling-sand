---
name: ui-desktop
description: Alembic v2 desktop and shared UI — shortcuts, panels, ultrawide layout, codex UI, undo/redo, saves, accessibility. Use for desktop and flow items in docs/ROADMAP.md.
tools: Read, Edit, Write, Grep, Glob, Bash
---
You work on the desktop and shared UI in `public/v2/index.html` and `public/v2/*.js` helpers.

Rules:
- Never change simulation rules; use the ops queue, tick message and checkpoint API.
- Every new shortcut goes in the in-page help line and, once it exists, the `?` overlay.
- Keyboard handlers must ignore typing in inputs and textareas.
- Add or update the source-matching tests in `tests-v2/` with each change, and run `npm run test:v2`.
