# Opening Foundation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task, inline in the current task. Steps use checkboxes for tracking.

**Goal:** Keep the opening nursery supported so its Mud remains adjacent to protected forage.

**Architecture:** Correct scene construction in seedVessel, where later painted circles currently overwrite the enclosure. Keep Grid.paint destructive for the user's brush and leave simulation/pickup rules unchanged. Test the enclosure and actual long-form nursery behavior.

**Tech stack:** TypeScript, Vitest, Vite, existing Three.js presentation.

**Spec:** [The Living Retort](../specs/2026-09-10-living-retort-design.md), slice 1a only. Donor supply, Adobe, observations, checkpoints and discharge are subsequent slices.

## Global constraints

- Keep animation driven by step(grid) on a 480x270 grid.
- Left pours, right names, right-drag pans; retain zoom, pause and speed controls.
- TDD for behavior changes; run the actual simulation in tests.
- No A*, colony ids, jobs, named rooms, trail/charge visor, engine rewrite or extra life-palette buttons.
- No new runtime dependency without a demonstrated need.
- Preserve unrelated files, council artifacts and existing worktrees.
- A passing test suite is not live QA. Distinguish implemented, headless-verified and browser-verified claims.

## Task 1: Preserve the enclosure and nursery

**Files:** Modify src/world.ts and src/world.test.ts. Link the product brief from README.md.

**Interfaces:** Consume new Grid(width, height), seedRng(seed), resetSim(), seedVessel(grid), step(grid), Grid.get(x,y). Preserve every existing public signature. No new simulation state or dependency.

- [x] Add a regression for the full seeded enclosure at 480x270 and 96x54. Expected floor bands are y=265..269 and y=51..53; sidewall widths are five and three. Every cell in those bands must be Stone after seeding. This catches terrain paint overwriting boundaries rather than asserting source text.
- [x] Add a nursery regression at 480x270 for seeds 1, 7 and 42. Reset RNG and simulation, seed the real vessel, and advance 1800 steps. At step 10 and every 60 steps assert Mud at (131,264) and (132,264), each with at least one N8 Plant/Bloom neighbor. No mocked movement or global count substitutes. Allow 30 seconds per case for slower machines.

Core assertion:

```ts
for (const x of [131, 132]) {
  expect(grid.get(x, 264)).toBe(Material.Mud);
  let forage = false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const id = grid.get(x + dx, 264 + dy);
      if (id === Material.Plant || id === Material.Bloom) forage = true;
    }
  }
  expect(forage).toBe(true);
}
```

- [x] Run `npm test -- src/world.test.ts` in PowerShell. Observe real assertion failures caused by overwritten Stone and fallen nursery Mud before changing production code.
- [x] Move the three enclosure fills from the beginning to the end of seedVessel, after all terrain painting and scene features. Comment why boundaries are stamped last. Do not change Grid.paint or the particle engine.

Move these existing calls intact:

```ts
fill(grid, 0, ground, w - 1, h - 1, Material.Stone);
fill(grid, 0, 0, wallN - 1, h - 1, Material.Stone);
fill(grid, w - wallN, 0, w - 1, h - 1, Material.Stone);
```

- [x] Rerun the targeted test. If behavior still fails, inspect the first failing coordinates and reaction; do not weaken nursery assertions or rewrite pickup.
- [x] Run `npm test`, `npm run lint` and `npm run build`. Inspect every exit status. Build includes TypeScript checking.

## Task 2: Live opening check and evidence

### Plan adjustment from the long-form regression

The enclosure repair exposed a second scene-construction defect. The lava cup's horizontal Glass row was at its top, leaving Lava in contact with the connected Stone foundation. With only the enclosure fixed, nursery Mud became Brick by step 840 (seeds 1 and 7) or 900 (seed 42).

Add a real 120-step containment test before correcting the cup: seed 7, record the 81 initial Lava grains, then require unchanged Lava count, all Lava strictly inside x=410..434 and above y=264, a Glass base at y=264 and Stone underneath. It failed with 570 Lava grains. Move the horizontal Glass row to ground - 1, rename cupBottom to cupTop for the sidewall origin, and leave the mouth open for pouring. This is a scene geometry correction; keep ignition and material behavior unchanged.

**Files:** Record results in this plan; screenshots may live under ignored qa-shots/living-retort. Do not add browser tooling to production dependencies.

- [x] Serve the candidate using Vite and open a real browser. Observe the shipped renderer and opening seed for at least 30 seconds at 1x without painting. Capture start/end views and inspect the nursery at a readable zoom afterward.
- [x] Check console and visual behavior: no runtime errors, stripped nursery, black porters or completely frozen scene. Record remaining limitations separately; this repair does not promise construction yet.
- [x] Smoke-check left paint, right probe and right-drag pan. Keep interventions separate from the untouched observation. Confirm 480x270 presentation and that observation was not of a paused vessel.
- [x] Review the exact diff and commit only intended source/tests and execution evidence. Keep the existing council artifacts untouched. No push or deployment is included.

## Execution evidence

Initial baseline: 6d64bcc, 168 tests passing. Commit the approved direction and this plan before implementation. Record red/green and live results below as they are obtained.

### Results

- Direction and initial plan committed as 4fed997 on codex/living-retort.
- RED: all five enclosure/nursery cases failed against the original world: overwritten Stone at (84,265) in the full vessel and (93,37) in the small fixture; fallen Mud at (131,264) by step 10 for all three seeds.
- RED after the first fix: nursery Mud fired to Brick after 840/900 steps. Separate Lava regression failed with 570 grains versus 81 initially.
- GREEN after correcting the enclosure and cup: all eight world tests pass, including 1800-step cases for seeds 1, 7 and 42.
- Full suite: 174 tests pass across 11 files. ESLint passes. TypeScript and Vite production build pass; Vite retains the existing warning for the approximately 552 kB minified bundle.
- Live Chromium at 127.0.0.1:5179: 31 seconds hands-off at 1x, 1869 simulation steps, HUD approximately 60 fps. Both nursery coordinates remain Mud with Plant above, four mites survive and move between sampled positions, and Lava stays at 81 grains. The rendered scene and enlarged nursery were visually inspected.
- Browser measurement used a temporary Playwright response substitution to expose the existing grid and increment a step counter. No particle rules, seed, clock or renderer were replaced; no QA instrumentation was added to production source.
- Separate paused interaction check: left click raised Sand from 994 to 1107 grains and painted the intended cell; right click named it Sand without changing count; a right drag moved the zoomed canvas by 75x40 CSS pixels with the same grain count.
- Browser console: zero errors. Twelve existing autoplay warnings from discovery chimes before a user gesture. Loaded-porters, fallback rendering and reduced motion were not newly certified by this scene repair.
- Local screenshots: qa-shots/living-retort/start.png, 31-seconds.png and nursery-detail.png. Generated evidence is ignored, not a runtime dependency.

### Next slice and remaining acceptance limits

The 30-second foundation gate passes. The ten-minute Living Retort milestone does not yet pass.

An extended hands-off observation reached 46.97 seconds / 2822 steps with the nursery still intact but 606 Lava grains. The existing automatic Ember gift fires at 45 seconds; rainFromCeiling currently writes its first grain at x=1,y=1, inside the seeded left Stone wall. This enables ignition of the enclosure. Correct that placement with a separate regression before accepting long-running habitat behavior or introducing the donor deposit. Do not suppress fire's ability to affect Stone to hide it.

The next executable slice is safe ambient-gift placement and a supported, reachable donor supply. Adobe, firing/rebuilding, landscape composition, observations, checkpoint restore and discharge remain subsequent work under the approved brief.
