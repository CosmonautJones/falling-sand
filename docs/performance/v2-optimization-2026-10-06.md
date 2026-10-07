# Alembic v2: skip idle simulation work

Baseline: `a163fde` (Pillars 1 and 2 already merged). This is the performance
foundation of Pillar 3, with the existing game behavior preserved.

The engine derives 8x8 activity and thermal masks from the authoritative arrays.
Ambient empty regions and inert solids skip cell processing. Fully supported
sand, gold, powder and relic grains with positive-zero velocities also sleep.
Their unused slide draws advance the physical random stream without computing
random output, preserving the existing sequence in active regions. Signed-zero
velocities take the ordinary path so checkpoint float bytes normalize as before.

Edits are included in the next mask rebuild. Movement and transmutation wake
the destination and neighboring chunks during the current sweep. Thermal masks
include a one-chunk halo for diffusion and buoyancy swaps; skipped thermal cells
contribute their known ambient heat to the existing convection field.

When heat covers more than 65% of the vessel, the engine uses the original
contiguous sweeps for up to 60 ticks before checking coverage again. This avoids
paying for sparse bookkeeping during storms. Clear, reset and restore discard
that performance hint. The dense and sparse thermal stencils deliberately stay
identical; future thermal changes must update both and run the equivalence check.

The new arrays are derived scratch, about 20 KiB per world. Activity counters
are available through `inspect().activity`. Checkpoint version 1, material IDs,
commands, flask storage and share-link formats do not change. There are no new
runtime dependencies or public-v2 build steps.

## Verification

- `npm run test:v2`: 124/124 passed, including 7 added idle/wake/restore tests.
- `npm test`: 168/168 passed. All pre-existing test files remain unchanged.
- `npm run lint`, `npm run typecheck`, and Pages production build passed.
- [Exact-state A/B results](evidence/v2-equivalence-2026-10-06.json): all 16
  cases matched the unchanged baseline (15 scene/seed combinations plus edits).
- Chromium portrait (390x844), landscape (844x390), and desktop (1440x900):
  element selection, pouring, pause, options and flask save/restore passed with
  no page errors. Screenshots of all three layouts and portrait options were viewed.
- Independent review compared exact captured state against the baseline for
  64 ticks across chunk seams, TNT/nitro blasts, remote gold-rod writes and all
  four sleeping powders. No open findings remain after the signed-zero fix.

The benchmark measures simulation steps only. It does not measure rendering,
worker transport, save encoding or real phone performance. Chromium emulation
does not establish acceptance on physical iPhone or Android devices.

## Reproduce (PowerShell, repository root)

```powershell
git worktree add --detach ..\alembic-baseline a163fde
npm ci
npm run test:v2
npm test
npm run lint
npm run typecheck
npm run build -- --base=/falling-sand/
node scripts/verify-ab-v2.mjs ..\alembic-baseline .
node scripts/bench-ab-v2.mjs ..\alembic-baseline . 5
npx vite --port 5179
```

Open `http://localhost:5179/v2/index.html` for local browser checks. The
equivalence script checks all four benchmark scenes plus the charged vessel,
three seeds, 720 ticks each, and a 240-tick edit/heat/cool/blast/load/wipe case.
It compares all captured fields and exact typed-array bytes, including RNG,
queues, events and grain payloads. Progress is on stderr; stdout is JSON.
