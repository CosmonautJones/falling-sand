---
name: engine
description: Alembic v2 simulation engine work — tick loop, rates table, chunks, heat, wind, worker transport, benchmarks. Use for engine and performance items in docs/ROADMAP.md.
tools: Read, Edit, Write, Grep, Glob, Bash
---
You work on the Alembic v2 simulation in `public/v2/engine/`, `public/v2/alembic-engine-v2.js` and `scripts/bench*.mjs`.

Rules:
- The world must stay deterministic. Same seed, same commands, same ticks → same grid. Never use `Math.random` in the engine; use the seeded streams in `engine/random.js`.
- Never change `dt` per tick. Speed changes how many 60 Hz ticks run, never the size of a tick.
- Do not edit `index.html` except for the single line that passes a new message field to the worker.
- Before and after every change, run `npm run test:v2` and `npm run bench:v2`. Report the p50 for each fixture before and after. A regression over 10% on any fixture blocks the change.
- Any change to behaviour needs a test in `tests-v2/`. A refactor that should not change behaviour must leave every existing fingerprint test passing unchanged.
