# Alembic V2 release log

[Play V2](https://cosmonautjones.github.io/falling-sand/v2/) · [GitHub releases](https://github.com/CosmonautJones/falling-sand/releases) · [Roadmap](docs/ROADMAP.md)

This log covers the browser V2. The [Godot V2 project](https://github.com/CosmonautJones/alembic-godot-v2) has its own builds and releases; its saves and feature set differ. Dates below are in America/New_York.

## 2026-10-16 — Seasons and weather warnings

### New

- **A year of four seasons.** Every vessel opens in spring. Each season lasts three weather spells of 80 seconds, so a full year takes 16 minutes at 1×.
  - Summer brings warm spells and never a cold snap.
  - Winter brings cold snaps and never a warm spell.
  - Spring and autumn are mostly calm, with autumn leaning cold.
- **Seasons change living things.** Gardens grow fastest in spring and slowest in winter, and mites spend much more of the winter resting.
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
