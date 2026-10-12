# Living Valley: first playable slice

Travis approved a procedural environment that remembers floods and fire. This
slice adds `/v3/index.html` alongside v2, sharing its grain physics without changing
v2 defaults, saves, materials or rites. No new dependencies or build step.

The first toy is a seeded valley with an elevated reservoir and a breakable dam.
Water grains feed a slower surface-soil model. Sixty eight-grain-wide patches
retain moisture, nutrients, dormant seeds and decomposing litter. Actual plant
grains grow only when their roots have water, nutrients and light. Flooded soil
favors reeds; burned ground favors fireflowers. Plants die when burned, uprooted
or persistently dry, returning their invested nutrients to litter. There is no
inherited evolution in this slice.

Soil water is counted in absorbed water grains. Growth and evaporation move it
to an explicit spent-water counter. Nutrient units move between soil, seeds,
plant grains and litter. Tools are explicit external additions/removals. This
is a toy resource budget, not a conservation claim for v2's alchemical chemistry.
Native v2 plant propagation and ambient ember rain are disabled only in v3.

Natural ground and the construction brush use fire-safe fired earth, rendered
as soil and stone. V2's native stone can fuel fire indefinitely; that behavior
would prevent the intended clearing/regrowth loop here. Burn provenance is
observed after every grain tick and immediately after a fire brush edit, so a
quick quench cannot erase it between soil updates. V3 saves reject deferred v2
commands and wipes that could replace the grain world behind the soil model.

Implementation and verification:

1. Add tests for seeded generation, water uptake, resource-funded growth,
   shade/drought, burning, and exact checkpoint continuation.
2. Add the small soil layer and valley wrapper, then a mobile canvas playground
   with dig, water, seeds, fire, stone, dam release, pause, reset and save/load.
3. Run existing checks unchanged, benchmark ecology overhead and v2 defaults,
   inspect desktop and portrait screenshots and exercise real browser controls.
4. Open a stacked PR on the current engine branch. Deploy remains pending merge.

First-slice limits: fixed-size world, vertical sunlight, surface patches rather
than a groundwater solver, no animal population/evolution, no physical-device
performance claim. The v2 engine remains the source of grain behavior.
