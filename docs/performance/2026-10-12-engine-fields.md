# Thermal mixtures and bounded scent diffusion

This pass reduces field-processing work while preserving the current engine's
simulation, random streams, tick order, material IDs and checkpoint format.
There are no new dependencies or build steps for v2.

## Changes

- Thermal material flags, cooling rates and phase thresholds are derived once
  from the existing material rules instead of branching on each cell each tick.
- Chunks containing different materials can reuse the thermal quiet cache when
  every material shares the same resting temperature. Neighbor edits, heat and
  cold still invalidate the cache. Heat sums, occupancy and activity are retained.
- Scent diffusion processes the nonzero field's rectangle plus a one-cell halo.
  New mite deposits are included before finding bounds. A coarse coverage sample
  selects the original full-field path for widespread scent; this decision affects
  processing cost only. Bounds are rebuilt rather than added to checkpoints.
- Output scratch is cleared before diffusion so shrinking fields, restores and
  previously used scratch cannot resurrect scent outside the current bounds.

## Performance

Baseline: `7ff5f624c8a02f853b28ce43852720dea2980b3d` (Pop the Dam candidate).
Windows x64, Node 22.19.0 / V8 12.4.254.21. Five interleaved A/B rounds,
120 warmup and 600 measured ticks per scene, alternating execution order.
Each reported value is the median of the five round medians. Tests and browser
automation were stopped during the final timing pass. Host noise is roughly 4%.

| Scene | Baseline median | Candidate median | Step time reduction |
| --- | ---: | ---: | ---: |
| Settled | 1.404 ms | 0.995 ms | 29.2% |
| Falling | 2.608 ms | 2.263 ms | 13.3% |
| Wet | 2.702 ms | 2.333 ms | 13.7% |
| Storm | 7.953 ms | 7.220 ms | 9.2% |

All four standard scenes pass the 10% regression gate. These timings measure
simulation CPU work, excluding rendering, worker transport, checkpoint encoding
and storage. They do not establish physical-phone performance or battery life.

Raw reports: [standard scenes](evidence/2026-10-12-engine-bench.json),
[additional field workloads](evidence/2026-10-12-engine-extra-bench.json).
The additional five-round workloads use 360 measured ticks: a resting mixture
of stone/wood/brick, the dam cascade, an enclosed mite's local scent, continuously
replenished full-field scent, and a continuously reheated full air field. Artificial
replenishment is outside timing; hot-air edits invalidate all thermal chunks.

## Correctness and browser acceptance

- 198 v2 tests and 168 existing tests passed. Existing tests were unchanged;
  six new tests cover mixed thermal caching, wake-up, exact scent values,
  reflective boundaries, stale scratch, restore/clear, new deposits and dense fields.
- Lint, type checking, the production build and JavaScript syntax checks passed.
  The existing v1 bundle-size advisory remains.
- [Exact-state comparison](evidence/2026-10-12-engine-verify.json) passed all 16
  cases against the baseline: three seeds across five scenes, plus edits,
  heat/cold, blasts, legacy load and wipe operations. Hashes include every saved
  field, exact typed-array bytes, random streams and pending commands.
- [Additional stress comparisons](evidence/2026-10-12-engine-stress.json)
  matched a 7,200-tick opening vessel, 960 ticks with all 53 materials and mixed
  temperatures, 1,800 ticks of dam play/retry, and 240 ticks of dense scent followed
  by a corner-only restored field. States were compared every 60 ticks.
- [Fresh Chromium contexts](evidence/2026-10-12-engine-browser.json) passed
  portrait, small phone, landscape, desktop, worker-free 2D fallback and ordinary
  motion/direct-entry flows. Actual taps/clicks released water; Again refilled the
  toy; Back restored the original full state through the flask UI. No page errors.
  These are emulated viewports on a desktop, not physical-device tests.
- Inspected the [portrait cascade](images/engine-portrait-cascade.png) and
  [2D fallback cascade](images/engine-2d-cascade.png) screenshots.

Reproduce the standard comparisons from PowerShell:

```powershell
git worktree add --detach ../alembic-engine-baseline 7ff5f624c8a02f853b28ce43852720dea2980b3d
node scripts/verify-ab-v2.mjs ../alembic-engine-baseline .
node scripts/bench-ab-v2.mjs ../alembic-engine-baseline . 5
npm run test:v2
npm test
npm run lint
npm run typecheck
npm run build -- --base=/falling-sand/
```
