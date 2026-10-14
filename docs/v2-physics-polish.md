# V2 physics and timing update — 2026-10-14

This patch ports demonstrated fixes from the independent native Godot V2 engine to the existing browser V2. It starts from `d29df16562db1f216a82dc654106530763a937e2` and preserves its creature life cycles, cold/heat behavior and weather. Classic and V3 simulation/rendering are unchanged. The separate WebGPU PR is not part of this physics patch; V2 keeps its current WebGL presentation.

## Shared corrections

- High-speed ballistic movement samples at most one cell on each axis per sample. The old eight-sample cap let impulses skip thin walls. Existing ordinary-speed contact, damping and diagonal rules remain intact.
- Movement checks source and destination bounds. Finite velocity is defensively bounded to ±1,000,000; a sweep has a `2*(480+270)=1500` sample budget and exits on contact/boundary. This is a computational guard, not physical terminal velocity. Normal gravity/fling limits stay at seven; blast impulses can exceed seven.
- Checkpoint validation rejects unsafe velocities before restoring any state, in typed/encoded/decoded paths. The format stays at version1 and normal older saves remain readable. Corrected fast trajectories and later RNG consumption can differ; exact replay requires the same engine version/runtime.
- The host uses fixed 60 Hz ticks, up to eight ticks per engine call, retaining up to 250 simulated milliseconds of backlog. Longer suspensions explicitly report discarded time. Pause/step clears fractional time. A small floor tolerance avoids undercounting at 144 Hz. The UI passes actual elapsed time to the engine instead of silently preclipping it.
- A separate validated held-tool descriptor produces one operation per committed tick, after queued explicit commands and before physics. No held operation is queued for a sub-tick poll or applied by a paused poll. Tick batches validate completely before any world mutation. Events survive multi-tick batches.
- Fling velocity uses world-space pointer displacement divided by elapsed time, with `1 - 0.5^(elapsedMs/(1000/60))` smoothing. Held fling decays by 0.85 per committed tick, preserving the 60 Hz response. Mouse and touch release stop painting; losing window focus cancels the stroke.

Explicit click/drag operations still preserve V2's responsive drawing and paused editing. Continuous touch spray/heat/cool adds an initial dab, then uses tick input; paused dragging still edits. Moving pours retain explicit connected line strokes. Therefore arbitrary pointer-event histories are not claimed to produce identical paintings. Batched worker input uses the latest held position; it does not reconstruct a historical pointer trajectory for every missed tick.

Godot's Compatibility-specific manual frame limiter is not applicable to the browser and was not ported. The browser remains on requestAnimationFrame with its worker/local fallback.

## Evidence and reproduction

The first six new regressions were run before the fixes: five failed, including a speed16 thin-wall crossing, unsafe restore acceptance, and 15 Hz playback advancing86 ticks instead of120 in two seconds. After repair, fixed schedules at15/30/60/144 Hz advance120 ticks at1× or240 at2× over two seconds; identical fixed held-pour/spray input produces matching complete checkpoints.

`tests-v2/physics-polish.test.js` covers both-direction thin walls at speeds7/16/32/1000 and multiple distances, material counts, extreme world boundaries, atomic velocity rejection, fixed host schedules, held-tool full-state comparisons, backlog/pause behavior, batch atomicity, elapsed-time fling, real transferable-buffer Node worker/local agreement, and touch-wand duplicate prevention. Node worker tests exercise the browser worker entrypoint with a test WorkerGlobalScope shim; they are not physical-browser/mobile certification.

The local full V2 suite passed207 checks before adding the worker and touch-specific cases; the focused file is rerun after those additions. Classic, V3, lint, type and production-build gates are also required. GitHub's `check` workflow runs the full current V2 suite. The Pages publication workflow now runs it too before building/deploying.

```sh
npm ci
npm run test:v2
npm test
npm run test:v3
npm run lint
npm run typecheck
npm run build -- --base=/falling-sand/
```

Local raw logs are ignored under `qa-shots/physics/`. Local preview-server startup was rejected by automatic approval review, so no new local interactive-browser evidence is asserted. Hosted deployment/browser verification is recorded separately after the commit is published. This patch does not claim a browser performance speedup or reuse the native Windows FPS measurements as web results.

## Source relationship and limits

[Native Godot V2](https://github.com/CosmonautJones/alembic-godot-v2) is initially private, with its tested Windows prerelease under `physics-20261014`. Shared math was reviewed at native commit `fcaeb9036b7b3686c49bd775001b8a635f749af0`; the Windows package records source `588377be5f0d590174cefc22d006cca8c5036d65`. The native reference remains pinned to its original source commit; it does not automatically contain newer browser weather/creature features. Checkpoint files are not interchangeable between runtimes.

This remains a cellular game simulation. Discrete density, integer heat, game damping and reactions are intentional approximations. Material cell-count conservation applies only to closed inert scenes; painting, reactions, phase changes, weather, ecology and visitors may add/remove/transform material. Physical momentum, energy, viscosity, pressure and hydrostatic equilibrium are not certified. Phone-sized control tests do not certify physical Android/iOS devices.

Rollback of the web change is a Git revert of the isolated physics commit followed by the normal Pages workflow. Existing saves are not migrated or erased; keep backups when comparing fast-motion replay between versions.
