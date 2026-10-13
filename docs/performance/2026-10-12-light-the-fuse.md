# Light the fuse

A second quick-play toy inside v2: three powder fuses, five casks, burning
supports, and a sand-and-water catch basin. The player supplies the spark.
Existing fire, powder, blast debris and steam produce the reaction. Starting
on another tier changes the first explosion; erasing a gap interrupts the fuse.
The full material palette remains available for improvising.

**Again** restores the setup. **Back to vessel** restores the original full
checkpoint and controls without consuming a flask slot. The recovery path
holds simulation and edits after a failed restore while leaving both actions
available. This also covers worker loss during entry.

Direct preview: `/v2/index.html?play=fuse`. This candidate branches from
`c4f456597b69483504c285fab8a9b3a36b2ee679` (v2 engine throughput, PR #23).
It contains no v3 changes and has not been merged or deployed.

## Fun acceptance

The intended loop is touch, watch the chain, change the setup, try again.
In six browser runs the first cask burst 638–695 ms after the input. Engine
tests show that the initial setup waits for input, another ignition point
changes the first blast, and a real gap can prevent the upper chain.
These checks establish responsive, consequential play. Travis trying it and
wanting another round is the remaining fun evaluation.

## Verification

- 207 v2 tests and 168 existing tests passed. Existing tests were unchanged;
  nine new tests exercise real reactions, replay, framing, session restoration
  and failure recovery.
- Lint, type checking and the production build passed. No engine, checkpoint
  format, dependency or v1 source changes. The existing v1 bundle-size advisory
  remains.
- A read-only code review found the restore recovery issue; it was fixed and
  reviewed again with no remaining findings.
- Fresh Chromium contexts passed portrait (390×844), small phone (320×680),
  landscape (844×390), desktop (1440×900), worker-free 2D fallback, and animated
  direct entry. Actual touch/mouse input lit the chain; Again restored all
  245 TNT grains; Back restored the full original state through the flask UI.
  Rotation preserved the ready scene. All six runs had zero page errors.
- These are desktop-emulated viewports, not physical-phone or Safari tests.

Raw browser evidence: [six configurations](evidence/2026-10-12-fuse-browser.json).
Screenshots actually inspected: [portrait ready](images/fuse-portrait-ready.png),
[portrait chain](images/fuse-portrait-chain.png), and
[desktop chain](images/fuse-desktop-chain.png).

## Performance

Windows x64, Node 22.19.0. Five interleaved A/B rounds against the exact base
commit, with 120 warmup and 600 measured ticks per scene. The engine and
fixtures are unchanged; differences below reflect timing variation, not a
claimed optimization. Tests and browser automation were stopped during timing.

| Scene | Base median | Candidate median | Candidate / base |
| --- | ---: | ---: | ---: |
| Settled | 1.046 ms | 1.066 ms | 1.019 |
| Falling | 2.792 ms | 2.582 ms | 0.925 |
| Wet | 2.751 ms | 2.825 ms | 1.027 |
| Storm | 9.083 ms | 9.269 ms | 1.020 |

All standard scenes pass the 10% regression gate. The largest measured increase
is 2.7%, within the host's roughly 4% timing noise.

The new toy benchmark uses five rounds, 120 warmup and 360 measured ticks.
The chain receives one fire dab at the start of measurement. Values are the
median of each round's p50 or p95. First blast and blast count are deterministic
event observations from the last round; the count includes individual TNT
grain events, not 133 separate casks.

| Fuse workload | Median tick | p95 tick | First blast after spark |
| --- | ---: | ---: | ---: |
| Ready | 1.087 ms | 1.144 ms | None |
| Chain | 3.263 ms | 5.760 ms | 37 ticks |

Timings cover simulation CPU work, excluding rendering, worker transport,
checkpoint encoding and input handling. They do not establish phone frame
rate or battery life.

Raw reports: [A/B](evidence/2026-10-12-fuse-ab.json),
[fuse workloads](evidence/2026-10-12-fuse-bench.json).

Reproduce from the candidate checkout in PowerShell:

```powershell
git worktree add --detach ../fuse-benchmark-base c4f456597b69483504c285fab8a9b3a36b2ee679
node scripts/bench-ab-v2.mjs ../fuse-benchmark-base . 5
node scripts/bench-fuse-v2.mjs 5
npm run test:v2
npm test
npm run lint
npm run typecheck
npm run build -- --base=/falling-sand/
```
