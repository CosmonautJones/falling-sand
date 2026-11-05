# Matter Lab

The expanded Alembic sandbox lives at `/v2/lab/index.html`. Run `npm ci`, then
`npm run dev`. The lab uses the existing V2 world and reaction engine. Activating
its gravity API selects the new motion model; existing campaigns and old saves
retain the original solver unless opened in the lab.

## The Matter Codex

Matter Lab starts in **Discovery first** with V2's 13 paintable starter materials.
Make something new through a reaction and its page opens: a whisper, a description,
and a new material to pour. The codex keeps 72 pages, with clues on unwritten ones
and a gentle next experiment. Discoveries never change the current brush.

Five research milestones supply materials that cannot be synthesized in this
engine: a living specimen, conductors and structural metals, cryogenic liquid,
magnetic materials, and very light matter. These pages are labeled **Research
supply**, separately from materials actually made in the vessel. Nitrogen is
discovered by letting the earned cryogenic liquid boil.

Choose **All materials workshop** to build without palette restrictions. This
does not fill the codex. Painting, blueprint placement and world import do not
earn pages; genuine reactions still do, in either access mode. Returning to
Discovery first keeps progress and returns the brush to sand if necessary.

Existing V2 discoveries carry into an independent Lab journal in this browser.
Lab never rewrites V2's progress. Clearing, undoing or restoring the world does
not erase the journal; world exports and blueprint files do not contain it.
If browser storage is unavailable, the journal works for the current visit and
the lab explains that it may not survive reloading.

Creation notifications are separate from sampled visual sparks and checkpoint
state. A transient material can write a page even if it disappears before the
next rendered frame. Notifications do not consume random numbers or change the
simulation's continuation.

## What to try

- Blast the truss bridge in Chaos yard, then reverse gravity.
- Place a townhouse, erase its foundation, and watch the disconnected assembly fall.
- Set gravity to zero and throw sand with Shift-drag. Momentum continues until a collision.
- Open Magnetic playground and watch ferrofluid gather around the magnets. Try Orbit gravity.
- Open Thermal shock and switch to the Heat lens to watch a cryogenic liquid meet copper.
- Place a creature habitat and add water or fire. Its creatures are the existing simulated animals.
- Pause, choose Capture, drag a rectangle, give it a name, and save it as a reusable blueprint.

There are 73 materials, including nine new entries: copper, steel, helium, liquid
nitrogen, nitrogen, tungsten, ferrofluid, aerogel and magnet. Eight built-in
blueprints cover buildings, a bridge, a volcano, a reactor, living habitats and
magnetic/cryogenic experiments. Five full setups provide starting worlds.
Blueprints support rotation, mirroring and portable JSON. World saves retain
particle velocities, subcell positions, heat, gravity and random generator state.

## Physics and rendering

The lab advances in fixed 1/60-second ticks. The user-facing gravity vector is
relative to the game's Earth preset, with magnitude bounded at 4. Velocity is
integrated before displacement, and fractional cell positions accumulate so
weak acceleration and weightlessness do not secretly fall one cell per tick.
Swept, bounded cell traversal checks intermediate collisions. Density ordering
handles displacement and buoyancy relative to the gravity vector. Warm-fluid
convection follows the opposite direction. Magnetic attraction uses a softened,
bounded field for the ferrofluid.

The cell pass follows each grain's predicted motion, moving leading grains
before their followers. This avoids false self-collisions when a dense stream
falls upward or sideways, keeps drifting in zero gravity, or turns against gravity.
Grid-line crossings use a small floating-point tolerance so identical grains
do not choose different destination cells at numerical precision boundaries.
Quiet 8×8 regions can skip physics work, but grains
are never merged into larger particles and the renderer redraws every cell.

Connected solid assemblies translate as units. Any component connected to a
world boundary is anchored. Cutting a connection detaches a component; changing
gravity affects its acceleration. This is a grid approximation: there is no
angular rigid-body solver, stress tensor, structural load rating or elastic
deformation. Living creatures retain their ecological movement rules, alongside
gravity drift; this is not a biomechanics model.

The natural renderer shades local surfaces with a diffuse lighting model,
Schlick Fresnel reflections and Beer–Lambert attenuation through transparent
material columns. Lighting is combined in linear RGB and encoded to sRGB for
display. Emissive materials receive a restrained glow. Heat and velocity lenses
use the real simulation arrays; rendering does not step or mutate the world.

The design references are the [Box2D simulation documentation](https://box2d.org/documentation/md_simulation.html)
for fixed-step motion/collision concepts, and [PBRT's transmittance chapter](https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance)
for attenuation. Neither library is a runtime dependency. Optical thickness is
in grid cells, density is relative, heat is a qualitative 0–255 game scale, and
alchemy remains deliberately fictional. This is a playful physics sandbox,
not a scientific simulator.

## Consolidation provenance

The live GitHub `main` was checked on November 4, 2026 and resolved to
`4930b211681ad96428a6cde65198f7a54a8ffb9a` (v0.2.0). Work reused the clean
`alembic-review` checkout at that revision.

The November 3 Turning Valley source package was compared with the repository.
Its V3 seasonal/journal additions and V2 Waterworks campaign were incorporated,
including their tests and the Windows newline correction in the seasons test.
Existing classic, V2 and V3 routes remain available.

Open phone-control PRs 41–46 and WebGPU presenter PR 28 were inventoried but
remain separate drafts. They are not silently treated as merged or device
qualified. The historical Alcubemy and native Godot variants are separate
runtimes. No remote branch, pull request, deployment or public release is
changed by the initial local consolidation.

## Production routing

The release uses the existing Netlify project `alcubemy` and domain
`alcubemy.travisjohnjones.com`, connected to this repository's `main` branch.
`netlify.toml` builds `dist` on Node 22 and sends root requests to V2 Playground.
Both V2 and Matter Lab have a visible mode switch; Matter Lab is the experimental
gravity-and-blueprint workshop, while V2 preserves the original playground experience.
The root HTML also redirects relatively so GitHub Pages' `/falling-sand/`
base works. The original root app is built as `/classic.html`; V2, Waterworks
and Turning Valley retain their routes. Both CI and Pages check the V3 suite.

## Reproduce checks and packages

```sh
npm test
node --test --test-concurrency=4 tests-v2/*.test.js tests-v3/*.test.js
npm run lint
npm run build
node scripts/pack-lab.mjs <output-directory>
```

The packer emits three self-contained HTML games with local navigation between
them. Keep the files together for those links. The source distribution includes
all routes and tests. Physical-phone performance and Safari/Firefox behavior
need separate qualification; emulated touch checks do not establish those.

## Verification on November 4, 2026

- Classic Vitest suite: 168/168 passed.
- Broad V2/V3 run: 383 passed and two old 64-material assertions failed. Both
  were corrected to test the expanded capacity while preserving classic IDs.
- Final focused physics/checkpoint/classic/blueprint/optics run: 87/87 passed,
  including both previously failing assertions. The final blueprint/optics
  rerun after UI integration passed 13/13.
- Lint, TypeScript and production build passed. Vite retains its pre-existing
  large-bundle warning for the classic Three.js bundle.
- Independent acceptance tests verified gravity direction, inertial motion,
  material conservation, deterministic continuation and atomic invalid imports.
- Desktop Chrome verified placement, rotation, mirroring, capture, material
  search, gravity, all lenses, world save/load and JSON export/import.
- Chrome with actual emulated touch input passed nine mobile checks at 390px
  and 360px, including a stationary held pour, capture, one-tap save, persistence
  after reload and deletion. No page errors were observed.
- Final offline files were opened from `file://` in a separate Chrome session.
  All three games booted with no page errors or failed requests. The lab's
  save/load, export/import, blueprint workflow and 360px layout passed. The
  campaign/valley return links resolved to the packaged Matter Lab.
- Renderer state comparison showed no simulation mutation across natural,
  heat and velocity rendering. A local 20-frame sample averaged about 11ms per
  render; a 60-tick Chaos yard sample averaged about 6.3ms per simulation tick.
  These are local smoke measurements, not device performance guarantees.
