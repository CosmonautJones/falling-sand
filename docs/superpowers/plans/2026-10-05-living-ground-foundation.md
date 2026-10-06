# Living Ground Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Alembic v2 state-isolated, tick-driven, and exactly resumable before extending its physics and ecology.

**Architecture:** Retain the existing public engine module and worker protocol while moving mutable simulation state into an instance-owned closure. Add versioned checkpoints, tick-stamped command execution, isolated random streams and browser save integration. Preserve scene-stamp imports as a distinct legacy feature.

**Tech Stack:** Existing JavaScript ES modules, Web Workers, typed arrays, Node test runner and Vite. No new runtime dependencies.

**Spec:** `docs/design/living-ground-council.md`, Stage 0.

## Global Constraints

- Retain 480×270 and all 43 existing material IDs.
- Mechanical simulation uses 60 fixed steps per simulated second; rendering cannot trigger simulation events.
- Every engine owns its mutable arrays, counters, entities, random states and queues.
- A checkpoint is taken after tick k commits and before tick k+1 commands execute.
- Exact continuation is scoped to the same engine version/runtime; do not claim cross-platform floating-point bit identity.
- Save migration must preserve existing material-stamp flasks and share links.
- Existing phone controls and original `/` version remain usable.
- No actual phone performance claim without an identified device measurement.

## Review Focus

- Two engines used in the same realm must never clear or advance one another (Task 1).
- Reset during a storm or after visitors arrive must reset every future-influencing field (Tasks 1–2).
- Paused polling and render batching must not age animals, start weather or advance world transitions (Task 2).
- Invalid, future-version or truncated checkpoints must leave the current world unchanged (Task 3).
- Oversized saves or unavailable browser storage must report failure without destroying the previous flask (Task 4).

## Program sequence after this foundation

The approved council scope remains the overall goal. Implement each subsystem on its own reviewed branch and write its detailed plan against the actual interfaces produced by the previous stage:

1. Foundation in this plan.
2. Grain residual integration, dissipative contacts, support lookup correction, slope hysteresis and underwater drag.
3. Small dry coherent boulders with owner masks, swept movement and bounded collision work.
4. Soil moisture, nutrient-limited plants, funded seeds and decomposition.
5. Conservative connected-water routing, dissolved quantity transport and atomic body displacement.
6. Sediment transport, energy-funded animals, weather inventories and multi-seed recovery experiments.
7. Resolved fluid-pressure prototype, body buoyancy, budgeted meteor impacts and fracture.

The full fluid-pressure replacement remains a separate solver design decision; the current council document intentionally does not select a discretization. Trapped-gas rupture and arbitrary structural fracture are later projects, not hidden promises in the first release.

---

## Task 1: Instance-owned world and random streams

**Files:** modify `public/v2/alembic-engine-v2.js`; create `public/v2/engine/world.js`, `public/v2/engine/random.js`, `tests-v2/state.test.js`.

**Interfaces:** `createWorld({seed, scene})` returns an instance with `step()`, `applyOperation(op)`, `captureState()`, `reset({seed,scene})`, `render(color,emis,fx,visualTick)`, and `inspect()` for tests. `scene` is `vessel` or `empty`. `captureState()` returns detached authoritative state, not live arrays. Immutable material tables remain shared. `createEngine(options={})` retains existing `tick` behavior and delegates to its own world. Replace the shared `_sim` test hook with a test factory exposing one fresh world's hooks.

- [ ] Add tests `engines_do_not_share_arrays_or_rng`, `reset_matches_fresh_world`, and `visual_rng_does_not_change_world`. Assertions: advance A and verify B's full capture unchanged; dirty A's wind/weather/trails then reset and compare with fresh same-seed world; render repeatedly and compare simulation continuation.
- [ ] Run `node --test tests-v2/state.test.js`; verify failure on existing shared-state behavior.
- [ ] Move mutable fields and simulation functions into the instance closure without changing reaction logic. Inventory all mutable declarations, including sense scratch, scan parity, weather/ship counters and census caches; classify authoritative versus deterministically rebuilt scratch. Implement seeded independent physical, ecology, weather and cosmetic generators. Cargo remains gameplay state even while encoded in shades.
- [ ] Adapt tests to create isolated worlds, retaining all existing behavior assertions. Run `npm run test:v2`; require zero failures. Compare seeded fixtures before/after refactor where splitting visual RNG intentionally changes exact scenes; behavioral contracts must hold.
- [ ] Review and commit `refactor: isolate Alembic world state and random streams`.

## Task 2: Tick-owned commands and environmental scheduling

**Files:** modify engine/world modules; create `tests-v2/timing.test.js`.

**Interfaces:** `engine.advanceTicks(count, commands=[])` advances a nonnegative integer number of ticks and returns events. A scheduled command is `{tick, sequence, op}`; reject past tick indices and duplicate sequence numbers at the same tick before mutation. `engine.render(...)` performs no world advancement. The legacy worker `tick` adapter converts wall-time and current ops into this API and retains bounded catch-up.

- [ ] Add tests `equal_ticks_ignore_render_batching`, `paused_polling_has_no_world_effect`, `commands_have_stable_order`, `past_commands_rejected_atomically`, and `reset_cancels_old_scheduled_events`. Compare full captures after exactly equal committed ticks under different render/message schedules, including odd scan parity and weather-eligible scenes.
- [ ] Run the timing tests and observe failures before implementation.
- [ ] Add explicit simulation tick and queued command ownership. Execute commands in sequence order, then the existing world step, then tick-scheduled environmental checks, then commit. Preserve existing thermal/reaction order in this stage; version any later phase-order change. Move census-triggered weather/visitor spawning and world-changing wipe progression off render-message count. Cosmetic flash may be presentation state only if no simulation branch reads it.
- [ ] Keep catch-up bounded and record discarded simulation time as telemetry. Paused editing may apply explicit user operations without advancing ticks; paused polling alone must not change world state. Rendering must never consume physical RNG.
- [ ] Run `node --test tests-v2/timing.test.js tests-v2/state.test.js` and the full v2 suite; review and commit `fix: make world evolution independent of rendering`.

## Task 3: Versioned atomic checkpoints

**Files:** create `public/v2/engine/checkpoint.js`, `tests-v2/checkpoint.test.js`; modify world and engine modules.

**Interfaces:** `engine.checkpoint()` returns a detached structured-cloneable envelope `{format:'alembic-world',version:1,width:480,height:270,tick,state}`. `engine.restore(checkpoint)` validates the complete envelope before committing and throws on invalid input. `encodeCheckpoint(checkpoint)` produces a JSON-compatible object with typed-array type tags and base64 byte payloads; `decodeCheckpoint(value)` validates and reconstructs it. A world checkpoint includes scheduled world commands and deferred work; the host wall-time accumulator is intentionally excluded and reset to zero on restore.

- [ ] Add tests `checkpoint_continues_exactly`, `checkpoint_is_detached`, `roundtrip_preserves_typed_payloads`, and `invalid_checkpoint_is_atomic`. Cover moving grains, heat, loaded mites, storm/ship state, tick queues and all RNG streams. Save at tick k, advance m ticks, restore, advance m ticks and compare full state.
- [ ] Cover unknown versions, wrong dimensions, short arrays, invalid material IDs, nonfinite velocities, invalid counters and bad base64; verify original capture unchanged for every failure.
- [ ] Run `node --test tests-v2/checkpoint.test.js`; verify failures before implementation.
- [ ] Implement schema validation into temporary storage, then atomically replace instance state. Enforce exact array lengths and a 16 MiB serialized input ceiling before decoding large payloads. Keep authoritative scalar/array inventory explicit; never serialize arbitrary object keys from untrusted input into engine properties.
- [ ] Run checkpoint and full v2 tests; review and commit `feat: add complete versioned world checkpoints`.

## Task 4: Full flask saves and legacy compatibility

**Files:** modify `public/v2/index.html`, engine worker response handling; create `public/v2/engine/flask-storage.js`, `tests-v2/flask-storage.test.js`.

**Interfaces:** worker operations add `{t:'checkpoint',requestId}` and `{t:'restore',checkpoint,requestId}` with structured success/error replies. Keep existing cells-only `snap/load` for legacy scene links. `saveFlask(storage,key,slot,entry)` accepts injected Storage-compatible access; prepares complete encoded entry and calls `setItem` only once. Preserve the previous stored value on quota failure. Entries distinguish `kind:'checkpoint-v1'` and legacy cells-only stamps.

- [ ] Add tests `legacy_flask_remains_loadable`, `new_flask_restores_moving_world`, `quota_failure_preserves_previous_save`, `malformed_flask_reports_error`, and `restore_response_clears_pending_ui`. Use real encode/decode with an in-memory storage adapter; inject only storage failure, not engine behavior.
- [ ] Run the new tests before implementation and confirm missing behavior.
- [ ] Update flask save/load to full checkpoints; retain thumbnail and timestamp. If local storage cannot fit a checkpoint, display a concise failure and offer a downloadable checkpoint file; never silently fall back to a lossy stamp. Keep share URLs as explicitly named scene stamps until a separate file-sharing design exists.
- [ ] Validate import size/version before requesting restore, and handle worker failures without hanging controls. Add an accessible status region for saved/failed/restored feedback.
- [ ] Run all tests, build and lint. Browser acceptance: save while sand falls, reload flask, verify continuation; test existing flask migration, denied storage and corrupt import. If browser runtime remains unavailable, report these tests pending and do not label them passed.
- [ ] Review and commit `feat: preserve complete world state in flasks`.

## Task 5: Deterministic benchmark fixtures and release evidence

**Files:** create `scripts/bench-v2.mjs`, `tests-v2/fixtures.js`; update README and `package.json` with `bench:v2`.

**Interfaces:** fixture builder takes `{scene,seed}` where scene is `settled`, `falling`, `wet`, or `storm`. Benchmark runs 120 warmup plus 600 measured ticks in a fresh world and outputs JSON with runtime, seed, scene, tick count, p50/p95/p99 step time and authoritative state hash. It does not assert server timing as phone performance.

- [ ] Add a fixture test proving identical full state after equal seed/ticks and distinct arrays between fixtures.
- [ ] Run the failing test, then implement deterministic bounded fixtures and benchmark reporting using existing Node APIs. Keep performance thresholds informational until real-device baselines are collected.
- [ ] Run `npm test`, `npm run test:v2`, `npm run build`, `npm run lint`, and `npm run bench:v2`.
- [ ] Request independent whole-branch review focused on omitted state, invalid checkpoint mutation and message-driven world changes. Fix important findings and rerun affected checks.
- [ ] Publish a foundation PR with test totals, compatibility changes and explicit pending device checks. Do not merge a downstream stage before its own conservation and performance gates pass.

## Plan self-review

Stage 0 is fully covered by Tasks 1–5. Downstream physics/biology remain separate planned stages above; this document does not pretend their solver interfaces are already implemented. The proposed final phase order in the council spec includes future bodies/ecology; Task 2 deliberately preserves current internal thermal/reaction order while removing render coupling. A later stage will version the extended order. All five review-focus inputs have named tests. No runtime library dependency or world-size increase is introduced.
