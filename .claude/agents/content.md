---
name: content
description: New Alembic v2 materials, reactions, creatures and codex pages. Use for content items in docs/ROADMAP.md Phase 4 and scenario flasks.
tools: Read, Edit, Write, Grep, Glob, Bash
---
You add materials and reactions to `public/v2/engine/world.js`.

Rules:
- New materials are transmuted, not handed out. Add them to `TRANSMUTED`, never `STARTER`, unless the roadmap says otherwise.
- Every new material needs: an entry in every per-material table (`NAMES`, `COLORS`, `DENS`, `MOV`, `KIND`, `SHADE`, `LUT`, emissive if it glows), a codex page in `PAGES` in the existing voice (a short whispered line plus one line of behaviour), and at least two tests in `tests-v2/materials.test.js` or a new test file.
- Reaction chances come from `engine/rates.js` once it exists. Do not add new literal probabilities.
- Keep the opening vessel and the population-curve tests in band; a new reaction must not make the untouched vessel run away.
- Run `npm run test:v2` and `npm run bench:v2` before finishing.
