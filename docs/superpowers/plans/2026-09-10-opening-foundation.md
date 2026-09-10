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

- [ ] Add a regression for the full seeded enclosure at 480x270 and 96x54. Expected floor bands are y=265..269 and y=51..53; sidewall widths are five and three. Every cell in those bands must be Stone after seeding. This catches terrain paint overwriting boundaries rather than asserting source text.
- [ ] Add a nursery regression at 480x270 for seeds 1, 7 and 42. Reset RNG and simulation, seed the real vessel, and advance 1800 steps. At step 10 and every 60 steps assert Mud at (131,264) and (132,264), each with at least one N8 Plant/Bloom neighbor. No mocked movement or global count substitutes. Allow 30 seconds per case for slower machines.

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

- [ ] Run `npm test -- src/world.test.ts` in PowerShell. Observe real assertion failures caused by overwritten Stone and fallen nursery Mud before changing production code.
- [ ] Move the three enclosure fills from the beginning to the end of seedVessel, after all terrain painting and scene features. Comment why boundaries are stamped last. Do not change Grid.paint or the particle engine.

Move these existing calls intact:

```ts
fill(grid, 0, ground, w - 1, h - 1, Material.Stone);
fill(grid, 0, 0, wallN - 1, h - 1, Material.Stone);
fill(grid, w - wallN, 0, w - 1, h - 1, Material.Stone);
```

- [ ] Rerun the targeted test. If behavior still fails, inspect the first failing coordinates and reaction; do not weaken nursery assertions or rewrite pickup.
- [ ] Run `npm test`, `npm run lint` and `npm run build`. Inspect every exit status. Build includes TypeScript checking.

## Task 2: Live opening check and evidence

**Files:** Record results in this plan; screenshots may live under ignored qa-shots/living-retort. Do not add browser tooling to production dependencies.

- [ ] Serve the candidate using Vite and open a real browser. Observe the shipped renderer and opening seed for at least 30 seconds at 1x without painting. Capture start/end views and inspect the nursery at a readable zoom afterward.
- [ ] Check console and visual behavior: no runtime errors, stripped nursery, black porters or completely frozen scene. Record remaining limitations separately; this repair does not promise construction yet.
- [ ] Smoke-check left paint, right probe and right-drag pan. Keep interventions separate from the untouched observation. Confirm 480x270 presentation and that observation was not of a paused vessel.
- [ ] Review the exact diff and commit only intended source/tests and execution evidence. Keep the existing council artifacts untouched. No push or deployment is included.

## Execution evidence

Initial baseline: 6d64bcc, 168 tests passing. Commit the approved direction and this plan before implementation. Record red/green and live results below as they are obtained.
