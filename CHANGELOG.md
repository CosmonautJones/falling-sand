# Alembic V2 release log

[Play V2](https://cosmonautjones.github.io/falling-sand/v2/) · [GitHub releases](https://github.com/CosmonautJones/falling-sand/releases) · [Roadmap](docs/ROADMAP.md)

This log covers the browser V2. The [Godot V2 project](https://github.com/CosmonautJones/alembic-godot-v2) has its own builds and releases; its saves and feature set differ. Dates below are in America/New_York.

## 2026-10-17 — The classic pack

Nine new things to discover, borrowed in spirit from the classic falling-sand toys and earned the Alembic way, by transmutation. None of the code is copied; each is rebuilt for this engine.

### New

- **Napalm.** Oil beside sulfur turns to a sticky jelly. Lit, it burns where it lies for about five seconds. Water only boils against it, and a blast throws it burning.
- **Methane.** Fungus beside water breathes swamp gas. It bubbles up through water, gathers under ceilings and flashes at a spark. A deep pocket explodes.
- **Wax and molten wax.** Honey against ice or snow sets as wax. A flame on top of a wax column eats down into it like a candle, and the odd drip of melt runs down the side and sets again. Lava and the heat wand melt it; water and the cool wand set it at once.
- **Concrete.** Mud beside pumice makes a heavy grey slurry that sinks through water and fills any mould. It sets to stone: in about 10 seconds on its own, or about 1.5 seconds against stone, brick or glass, so a pour cures from its walls inward.
- **C-4.** Nitro beside wax kneads into a putty that stays where it is put. Heat alone won't set it off, but a flame, ember, lava or burning fuse will. It has more than twice the blast radius of a TNT cask, and every block of it touching the blast goes off too.
- **Fuse.** Plant beside powder turns to a cord you can lay in lines. Lit, it burns along at about seven grains a second and sets off whatever waits at the end. Water won't save it once it is lit.
- **Cryo.** Aether against ice falls as a freezing powder. It freezes water within two grains, turns lava to obsidian, snuffs fire and burning napalm, and spends itself as snow.
- **The font.** Aether touching a pearl makes a font. It learns the first thing that touches it and pours it forever: a well for water, a spout for sand, upward for gases, and a steady torch for fire. It will not copy walls, voids, rifts or visitors.
- **Tap tool.** The new seventh tool sets down a font already taught your brush element. Line the top of the vessel with taps, like the spigots in the old toys. With air as the brush, the font learns from whatever touches it first.

### Notes

- Every material slot is now used (64 of 64). The next new material needs the material tables widened first; this is on the roadmap.
- Saved flasks keep fonts but not what they learned. A loaded font learns again from whatever it is touching, usually the stream it was pouring.

## 2026-10-17 — Snow that behaves like snow, glow that lights caves

### Improved

- **Snow piles into soft mounds.** It used to stack into vertical towers and columns, because its friction rule refused to slide whenever the cell two below was blocked. It now slumps into low drifts.
- **Snowfall flutters.** Slowly falling flakes come down about eight times slower than sand, hang in the air for a moment, and drift sideways. Snow that is thrown, blasted or caught by a strong wind still flies freely.
- **Avalanches.** A snow grain that slides pulls the snow above it along, so a bank pushed off a ledge pours over as a mass.
- **Deep snow packs to ice.** Snow buried under eight or more grains of snow or packed ice slowly turns to ice, so the inside of a deep drift becomes a small glacier over a few minutes. Shallow layers stay snow.
- **Snow and ice look better.** Snow gets a bright top crust, a cool blue body and the odd glint. Ice is clearer blue with faint cracks.
- **Glow lights caves.** Light from lava, fire and embers reaches further, especially into enclosed spaces, and open air inside caves sits in shadow. The lighting setting scales both.

### Fixed

- **Steamy caves no longer set plants on fire.** Steam is held at heat 90 and plants used to ignite from heat at 62, so steam trapped under a cave roof cooked hanging plants into flame. In a test, 15 of 16 steamy caves caught fire before this fix and none after. Living, water-filled growth (plants, seeds, blooms, fungus) now catches from heat alone only at 100, above anything steam can reach. Dry fuel (wood, oil, powder, sulfur) still catches at 62, so wood leaning on a hot lava cup still lights. Flames, embers, lava and the heat wand light everything as before.

## 2026-10-16 — Seasons and weather warnings

### New

- **A year of four seasons.** Every vessel opens in spring. Each season lasts three weather spells of 80 seconds, so a full year takes 16 minutes at 1×.
  - Summer brings warm spells and never starts a cold snap.
  - Winter brings cold snaps and never starts a warm spell. (Weather eases from one spell to the next over about 20 seconds, so a warm end of autumn can linger briefly into winter.)
  - Spring and autumn are mostly calm, with autumn leaning cold.
- **Seasons change living things.** Gardens grow fastest in spring and slowest in winter, wet mud sprouts seeds less often as the year turns, and mites spend much more of the winter resting. Spring keeps the growth-cycle rates from the native growth cycle unchanged, and dry plants decay at the same rate in every season.
- **Warnings before the weather turns.** About 40 seconds before a cold snap or warm spell:
  - a whisper names what is coming;
  - frost creeps in around the glass before a cold snap, or a warm glow with rising shimmer comes before a warm spell;
  - the frost or glow stays while the spell lasts.
- **The almanac.** A small year dial under the tallies (desktop) and a line in the phone status bar show the season and either the current weather or a countdown such as "winter · cold snap in 22 s". The countdown follows the current speed.

### Fixed

- Weather picked cold snaps far more often than intended. A signed number in the spell picker made half of all draws read as cold. Warm and calm spells now come at the rates above.

### Notes

- Seasons, forecasts and omens come from the world seed and the tick, like the rest of the weather. They need no new saved state and replay exactly from checkpoints.
- Living Valley (V3) keeps weather off, so it has no seasons.
- Older saves keep their contents, but their weather from this point on differs from before this update, because spells are now 80 seconds and chosen by season.
- Day and night are not part of this release.

## 2026-10-16 — Native growth cycle and explorer fixes

- Added the native browser V2 water → plants → mites → decay → new growth
  cycle. Plant moisture requires adjacent water, or mud that itself touches
  water; dry ash no longer irrigates.
- Dry and wet plant/bloom decay, mud-to-seed growth, food-backed mud-to-mite
  births, and the native three-mite neighborhood cap use probability averages
  from the `ECOLOGY` table. Existing seed-by-mud germination, ash-plus-water
  mud, feeding, cargo spill, heat, ice and timing behavior remain intact.
- Managed V3 vegetation keeps its existing behavior, and the native cycle adds
  no material IDs, checkpoint arrays, save-format changes or physics framework.
- Legacy pond coverage now spans seeds `4`, `9` and `17`, with per-seed plant
  and water-retention bounds plus an aggregate `80..125` plant band. Three
  fixed-seed, ten-minute shore runs ended with plants and mites and 86–96% of
  starting water; this is finite-window evidence, not guaranteed equilibrium.
- The explorer now falls when its support disappears. Invalid tool batches
  leave it unchanged, drop coordinates stay finite and inside the vessel, and
  a poke moves only one cell along one axis.
- Same-host A/B measurements pass the 10% median-step regression gate in all
  four stress scenes; the largest increase was 3.6%. See the evidence note for
  tail timings, population curves and limits.

See the [V2 growth-cycle note](docs/v2-growth-cycle.md) for finite-scene limits,
same-runtime replay scope and the profile command.

## 2026-10-15 — Tiny explorer and close-up grains

Shipped in [#33](https://github.com/CosmonautJones/falling-sand/pull/33).

- Press **I** to enter or leave the tiny explorer. Walk with arrows or WASD,
  hop with **X**, switch hand with **H**, switch weapon with **Q**, and use
  the current one-cell tool with **E**. It is a session helper and is not saved
  in flasks.
- Sharper grain shading at close zoom, with small animated creature shapes.
- Added beetles and newts as material IDs 53 and 54; existing IDs 0–52 remain
  unchanged. Beetles graze fungus; newts swim and move on land.

## 2026-10-14 — Physics, input and clearer ice rules

### Improved

- Fast particles check movement at cell resolution, preventing the previous thin-wall skips. Restored velocities and world boundaries have explicit safety checks.
- Fixed 60 Hz simulation ticks continue through slower rendering, with bounded catch-up and reported discarded time after long suspensions. Pause and single-step reset leftover fractional time.
- Held pour, spray and heat/cool tools apply per simulation tick. Fling strength uses pointer distance over elapsed time; its decay and cutoff also run per tick, including catch-up batches. Releasing the pointer or losing focus ends a stroke.

The collision and timing changes shipped in [#30](https://github.com/CosmonautJones/falling-sand/pull/30), with the held-fling correction in [#31](https://github.com/CosmonautJones/falling-sand/pull/31). See the [physics evidence and limitations](docs/v2-physics-polish.md).

### Clarified

- Ice's Codex entry now explains cold-water contact freezing, warm-water thawing, cold snaps, the cooling wand and brine resistance. This clarification does **not** change thermal tuning.
- Added six fixed-seed freezing checks: cold-water contact, warm-water resistance, cold-snap contact, brine resistance in calm/cold weather, and the cooling wand. The contact fixtures exclude surface-weather freezing and check water/ice cell counts.
- Added this log and a **what's new** link under desktop **More** and in the phone **Options** sheet.

### Known limits

- Heat is a 0–255 game field, not degrees Celsius or a certified energy-conserving solver. Reactions, ecology, weather and painting can transform or add/remove material.
- Exact checkpoint continuation requires the same engine version/runtime. Explicit drawing still depends on the actual pointer path; per-tick held-tool tests do not promise identical results for arbitrary mouse/touch histories.
- Physical iOS/Android performance and long-session testing remain pending. The separate WebGPU experiment ([#28](https://github.com/CosmonautJones/falling-sand/pull/28)) is not deployed; V2 still uses WebGL.

## 2026-10-13 — Creatures, heat balance and weather

Shipped in [#29](https://github.com/CosmonautJones/falling-sand/pull/29).

- Minnows fall and gasp on land. Mites can die from age, hunger, drowning or being frozen in.
- Heat exchange rounds symmetrically and materials return toward their resting heat. This removes the old one-way cooling bias that let ice consume an entire warm pool.
- Ice freezes already-cold water, thaws against warm water, and melts under lava before the lava crusts.
- Deterministic warm spells, cold snaps and storm gusts follow the world seed and simulation tick. Cold snaps can skin exposed water with ice and turn storm rain to snow; warm spells thaw exposed ice.

### Why doesn't my ice freeze the whole pool anymore?

That was an intentional balance change in #29, before the October 14 physics fixes. Ordinary water starts at game heat **34**, while ice rests at **14**. Contact freezing needs water below **12** in calm weather, rising to below **18** in a full cold snap. Heat exchange runs before the contact check, so briefly chilling one grain may not keep it cold enough. Warm water can slowly melt the ice instead.

Use the **cool** wand under **More / Options → Tools** to freeze water directly, or let a cold snap skin exposed water. Brine is excluded from passive contact/weather freezing; the cooling wand can freeze it, but much less readily. These are game rules, not a physical salt-water phase model.

## 2026-10-13 — Pace and phone zoom

Shipped in [#27](https://github.com/CosmonautJones/falling-sand/pull/27).

- Added ¼× speed and remembered speed preference.
- Added deterministic single-step while paused: **.** for one tick, **Shift+.** for ten, plus desktop/phone step buttons.
- Added a phone zoom button, two-finger tap zoom toggle and pinch snapping near whole zoom levels for crisper grains.
