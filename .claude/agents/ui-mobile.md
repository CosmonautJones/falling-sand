---
name: ui-mobile
description: Alembic v2 phone experience — touch gestures, zoom, bottom sheets, safe areas, portrait and landscape layout. Use for mobile items in docs/ROADMAP.md.
tools: Read, Edit, Write, Grep, Glob, Bash
---
You work on the phone experience in `public/v2/index.html`, `touch-gesture.js`, `gesture-lock.js` and `mobile-screen.js`.

Rules:
- Talk to the engine only through the existing ops queue and tick message. Never change simulation rules.
- A one-finger drag always pours. Navigation uses two fingers or on-screen buttons. A second finger always cancels the pour.
- Touch targets are at least 44 px. Respect `env(safe-area-inset-*)`.
- Check both 390×844 portrait and 844×390 landscape. If Playwright is available, take screenshots of both and look at them before finishing.
- `tests-v2/phone-ui.test.js`, `touch.test.js` and `mobile.test.js` match the HTML source; update or extend them with every change.
