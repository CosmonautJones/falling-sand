# falling-sand

A browser falling-sand toy: a dense cell grid of materials, stepped once per frame and blitted
to a canvas one pixel per cell.

## Current state

The scaffold is real but the physics is a stub. `src/sim.ts` moves sand straight down into air
and does nothing else — water is inert, air is just an empty label, and sand piles into
flat-topped columns. `src/sim.test.ts` documents those gaps as explicit failing-by-design
expectations rather than leaving them implicit.

| File | Role |
| --- | --- |
| `src/grid.ts` | Flat `Uint8Array` cell store. Out-of-bounds reads return Stone, so the world is an enclosed box. |
| `src/materials.ts` | Material ids, colours, densities, movability. |
| `src/sim.ts` | **The baseline to replace.** Naive sand-only step. |
| `src/render.ts` | Reused `ImageData` blit, one pixel per cell. |
| `src/main.ts` | Canvas wiring, brush input, RAF loop, fps readout. |

## The objective

Replace the baseline step with a real simulation engine that models:

1. **Air as a moving medium** — pressure, not just an empty cell label. Air should be displaced
   by falling solids, compress under them, and push back.
2. **Liquids with flow and density exchange** — water spreads laterally, seeks its own level,
   and heavier materials sink through it while lighter ones rise.
3. **Granular solids with an angle of repose** — sand slides down slopes instead of stacking
   into vertical columns.

### Constraints

- 240 x 160 cells (38,400) sustaining 60 fps in a browser on a mid-range laptop.
- Mass conservation: no material may be created or destroyed by movement.
- No update-order artifacts strong enough to be visible as a directional drift.
- TypeScript strict mode, no `any`. Tests are mandatory and must not regress.
- Deterministic given a seed — the test suite has to be able to assert on exact grid states.

## Commands

```bash
npm install
npm test          # vitest run
npm run typecheck # tsc --noEmit
npm run dev       # vite dev server
npm run build     # typecheck + vite build
```
