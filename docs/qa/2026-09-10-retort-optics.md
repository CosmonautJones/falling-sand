# Retort optics verification

Bounded refinement of the approved Living Retort visual direction. Simulation rules, opening terrain and controls are unchanged.

## Presentation

- Optical masks use actual material identity and temperature, replacing RGB guesses for heat, water and reflective surfaces.
- Fire, Lava and Ember produce warm light; Aether produces blue light; Azoth and Rift produce violet light. Glass, crystals and metals reflect without becoming light sources.
- A 120×68 glow texture is rebuilt from the 480×270 grid and blurred in two small passes. The Three.js shader composites it over crisp grains. This is decorative light spill, not occluded physical lighting or a simulation field.
- Water has moving caustics and a surface highlight. Glass and metal have edge highlights and occasional slow glints. The edge vignette is lighter to improve readability near the vessel floor.
- Reduced motion freezes shader time and grain modulation while retaining static illumination. The 2D fallback retains grain rendering and gentle gold modulation under normal motion.

## Evidence

- New optical-mask tests failed before implementation. The glow-map regression failed before that implementation. Final suite: **191/191 tests passed**, 13 files.
- Lint, production build and diff whitespace checks passed. Existing Vite bundle warning remains: 556.43 kB, 145.68 kB gzip.
- Live opening after 2057 displayed beats retained Lava 81, Water 1367, four Mites and both nursery Mud cells. Inspected opening and a temporary material sampler; the sampler is not shipped as the opening scene.
- The initial per-fragment glow sampling was rejected after a live measurement around one second per frame on Intel Iris Xe. The retained coarse glow map measured **16.57 ms mean frame interval over 182 animation frames**, with a 16.9 ms maximum in that three-second sample. This is a short local measurement, not a universal frame-rate guarantee.
- A separate material-sampler draw loop measured 4.30 ms per draw on the CPU/submission side; GPU completion is not implied by this number. Repeated draws left material state unchanged.
- Separate browser contexts verified reduced motion with both WebGL and forced 2D fallback: repeated presentation produced identical canvas images and unchanged material state at 480×270.
- Normal WebGL browser console: no errors. The existing 12 AudioContext autoplay warnings appeared on fresh load.
- Ignored local screenshots: `qa-shots/retort-optics/opening-after.png`, `material-sampler.png`, `reduced-motion.png`, and `fallback.png`.

The opening composition remains sparse. This pass improves material presentation; donor mud, Adobe construction and behavioral discoveries remain separate work.
