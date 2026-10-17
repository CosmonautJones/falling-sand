# Alembic v2 roadmap

Where v2 goes next: denser things to discover, a calmer pace, easier zoom on phones, and a better fit for big screens. Each phase is sized for one developer driving Claude Code, with agent teams working in parallel where the files don't overlap.

## What v2 already has (checked against the code, October 2026)

Some ideas from the original research turned out to exist already. They are listed here so nobody rebuilds them.

| Area | Already in v2 | Where |
|---|---|---|
| Fixed timestep | 60 Hz ticks from an accumulator, max 8 ticks per engine call, up to 250 simulated ms of backlog; excess time reported and discarded | `alembic-engine-v2.js` `tick()` |
| Worker transport | Colour, emissive and fx buffers are transferred (ping-pong), not copied | `alembic-engine-v2.js` worker block, `index.html` `send()` |
| Shader renderer | WebGL pass with per-material shade, bevels, liquid refraction, gas and smoke, multi-level emissive bloom, shake, flash | `index.html` fragment shader |
| Per-grain variation | `SHADE` table per material | `engine/world.js` |
| Material feel | `DENS`, `DISP`, `FRIC`, `VISC` tables; 55 materials incl. snow, honey, amber, fungus, firefly, coral, pumice, beetle and newt | `engine/world.js` |
| Desktop zoom | Wheel zooms at the cursor; trackpad two-finger scroll pans; ctrl-wheel pinch; `+` `−` `F`; minimap | `index.html` |
| Phone zoom | Two-finger pinch zooms and pans around the finger midpoint; a second finger cancels the pour | `index.html` pointer handlers |

The real gaps are pacing controls, phone zoom ergonomics, a single place to tune reaction rates, content density, and measured phone performance.

## Phase 1 — Pace and phone feel (shipped in the first PR)

| # | Item | Status |
|---|---|---|
| 1.1 | ¼× speed alongside ½×, 1×, 2× | done |
| 1.2 | Step one tick while paused (`.` key, `Shift+.` for ten, step button); comma cycles speed — deterministic | done |
| 1.3 | Remember the chosen speed between visits | done |
| 1.4 | A zoom button in the phone bar (thumb reach, off the vessel): 2× → 4× → whole vessel | done |
| 1.5 | Two-finger tap toggles between fit and a 3× close-up at the tap | done |
| 1.6 | Pinch snaps to a whole zoom level when released near one, so grains stay crisp | done |

## Phase 1b — Living things, cold and weather (shipped in the second PR)

| # | Item | Status |
|---|---|---|
| 1b.1 | Minnows fall out of water and gasp to ash on land | done |
| 1b.2 | Mites die of old age, hunger, drowning and being frozen in (`LIFE` table) | done |
| 1b.3 | Heat exchange no longer drains toward the coldest grain; things settle back to resting heat | done |
| 1b.4 | Ice freezes only cold water and thaws in warm water; lava melts ice before crusting (`COLD` table) | done |
| 1b.5 | Warm spells and cold snaps from seed and tick, storm gusts, HUD and whispers (`CLIMATE` table) | done |
| 1b.6 | Open: lava slowly eats the stone floor in the untouched vessel (81 → ~900 grains in 4 min, also on main) | todo |
| 1b.7 | Open: real mite hives — a nest, kept-open tunnels, stored food | todo |
| 1b.8 | Seasons: a 16-minute year (spring, summer, autumn, winter) that sets which spells come; plants grow slower and mites rest more as the year turns (`SEASON_ODDS`, `SEASON_LIFE`) | done |
| 1b.9 | Forecast: an almanac dial and countdown, omen whispers 40 s ahead, frost and warm glow on the glass | done |
| 1b.10 | Open: day and night — a slow light cycle, cooler nights, fireflies that glow after dark | todo |
| 1b.11 | Snow: mounds instead of towers, fluttering snowfall, avalanches, deep snow packs to ice (`SNOWFALL`) | done |
| 1b.12 | Look: snow crust and blue body, clearer ice, glow that lights caves and shadowed cave air | done |
| 1b.13 | Fix: steam can no longer ignite plants (living growth ignites from heat at 100, dry fuel still at 62) | done |
| 1b.14 | Next: the logic layer — quicksilver current (Wireworld-style wires, sensors, gates, outputs) and animus (Game of Life material) | todo |

The `LIFE`, `COLD` and `CLIMATE` tables move into `engine/rates.js` in Phase 2.

## Phase 1c — Native growth cycle (implemented)

The browser V2 native path now closes a local water-to-growth loop while
preserving the existing materials and simulation framework.

| # | Item | Status |
|---|---|---|
| 1c.1 | Dry and wet plant/bloom decay with probability-average ecology rates | done |
| 1c.2 | Watered growth requires water directly or through freshwater-fed mud | done |
| 1c.3 | Exposed freshwater mud spends itself on a seed or food-backed mite, with a three-mite local cap | done |
| 1c.4 | Keep managed V3 vegetation outside the native cycle | done |

Three fixed-seed ten-minute shore soaks now record population curves and water
retention. Broader rates-table migration and longer/more varied population
profiling remain Phase 2; see [the growth-cycle note](v2-growth-cycle.md).

## Phase 2 — One rates table (foundation for all content work)

The world feels fast partly because each reaction's chance is a literal scattered through `world.js` (`rnd() < 0.02`). Past "too fast" fixes (lava eating stone, plants paving ponds, rites unlocking at once) were each fixed by hand.

| # | Item | Effort | Depends on |
|---|---|---|---|
| 2.1 | `engine/rates.js`: every stochastic reaction as named events-per-second at 1×; per-tick chance = `1 − exp(−rate / 60)` | M | — |
| 2.2 | Move reaction literals in `world.js` onto the table without changing behaviour (fingerprint tests must stay identical) | M | 2.1 |
| 2.3 | "Reaction pace" setting that scales only chemistry and growth, not falling or flowing | S | 2.2 |
| 2.4 | Population-curve tests: lava, water, plant counts at 10, 30, 60 s stay within bands for each fixture | S | 2.1 |

## Phase 3 — Measure on real phones

| # | Item | Effort | Depends on |
|---|---|---|---|
| 3.1 | In-browser bench overlay that runs the four fixtures (settled, falling, wet, storm) in the worker and exports JSON | M | — |
| 3.2 | Phone baseline recorded in `docs/performance/` (an iPhone and a mid-range Android) | S | 3.1 |
| 3.3 | Hot spots from PR #10: heat at half rate in quiet chunks; plants as a list of growing tips; storms that only wake the chunks rain lands in | M | 3.1 |
| 3.4 | Pause the sim when the tab is hidden; drop to 30 fps rendering when most chunks sleep | S | — |

## Phase 4 — Content wave (more to discover)

New materials are transmuted, not handed out. Each one needs a codex page, a hint, and at least two tested interactions.

| # | Item | Effort | Depends on |
|---|---|---|---|
| 4.1 | Electricity: a spark runs through lead, gold and mercury; sets off tnt, powder and nitro; splits brine into salt and gas; crystal conducts one way | L | 2.2 |
| 4.2 | Fulgurite: lightning or spark on sand makes glass branches | S | 4.1 |
| 4.3 | Rust: lead plus water plus time | S | 2.2 |
| 4.4 | Frost: aether-chilled ice that freezes water outward | S | 2.2 |
| 4.5 | Per-world secret recipe: three ingredients chosen by the world seed, hinted by codex riddles | S | — |
| 4.6 | Codex v2: silhouettes of undiscovered products ("? + water → ?"), progress ring, a witnessed log | M | — |
| 4.7 | Wind and pressure: a coarse field driven by storms, blasts and a new bellows; pushes gas and light grains | L | 3.1 |
| 4.8 | Pollinator creature: carries bloom to make honey, glows at night | M | 2.2 |

## Phase 5 — Game layer

| # | Item | Effort | Depends on |
|---|---|---|---|
| 5.1 | Stroke-level undo and redo from a ring of checkpoints (`Ctrl+Z`, two-finger double tap on phones) | M | — |
| 5.2 | Challenges built on the existing ambitions: goals that load a prepared flask | L | 4.6 |
| 5.3 | Six scenario flasks: volcano island, flooded mine, alchemist's lab, clockwork circuit, frozen lake, garden in a storm | M | 5.2 |
| 5.4 | Thermal view mode (heat as colour) from the existing heat field | S | — |
| 5.5 | Searchable element sheet with hints on locked slots | M | 4.6 |

## Phase 6 — Big screens and scale

| # | Item | Effort | Depends on |
|---|---|---|---|
| 6.1 | Quality tiers picked by a two-second warm-up benchmark; phones start low | M | 3.1 |
| 6.2 | Ultrawide: codex and palette docked at the sides instead of letterbox bars | M | — |
| 6.3 | "Grand vessel" 960×540 world on fast desktops | L | 3.3, 6.1 |
| 6.4 | Shortcut overlay (`?`) and command search (`/`) | M | — |
| 6.5 | Only if 3.2 shows the need: multi-worker checkerboard sim on SharedArrayBuffer (GitHub Pages needs the coi-serviceworker shim), or a Rust/Wasm hot loop | XL | 3.2 |
| 6.6 | Accessibility: colour-blind palette, reduced motion, keyboard-only play | M | — |

Effort: S ≤ 1 day · M 2–4 days · L 1–2 weeks · XL more than 2 weeks.

## Agent teams

Agent definitions live in `.claude/agents/`. Each one owns a set of files so teams can work at the same time in separate git worktrees.

| Agent | Owns | Never touches |
|---|---|---|
| `engine` | `public/v2/engine/*`, `alembic-engine-v2.js`, `scripts/bench*` | `index.html` UI |
| `content` | New materials, reactions and codex pages in `engine/world.js` | Renderer, gestures |
| `ui-mobile` | Gestures, sheets, phone layout in `index.html`, `touch-gesture.js` | Engine rules |
| `ui-desktop` | Shortcuts, panels, ultrawide layout, codex UI in `index.html` | Engine rules |
| `reviewer` | Read-only: runs tests and bench, reviews every PR | Writes nothing |

Merge gate for every PR: `npm run test:v2` passes, `npm run bench:v2` shows no more than a 10% regression on any fixture, and any change to behaviour comes with a test.

### Workflow per phase

1. Run the phase prompt below in Claude Code from the repo root.
2. The lead splits the phase into items and starts one agent per stream in its own worktree.
3. Each agent opens a draft PR per item with a bench delta.
4. The `reviewer` agent reviews each PR; the lead merges in dependency order.

### Phase prompts (paste into Claude Code)

**Phase 2**
> Read docs/ROADMAP.md Phase 2. Use the engine agent to create engine/rates.js and move every stochastic reaction chance in engine/world.js onto it without changing behaviour; existing fingerprint tests must pass unchanged. Then add the reaction-pace setting and population-curve tests. Have the reviewer agent check the PR before you finish.

**Phase 3**
> Read docs/ROADMAP.md Phase 3. Use the engine agent to build an in-browser bench overlay (?bench in the URL) that runs the four bench fixtures in the worker and offers a JSON download. Then attack the three hot spots one PR at a time, each with an A/B bench from scripts/bench-ab-v2.mjs.

**Phase 4**
> Read docs/ROADMAP.md Phase 4. Run the content agent on 4.3, 4.4 and 4.5 in parallel worktrees, and the engine agent on 4.1. Every new material needs a codex page, a hint, and two tested interactions, and must not move the population-curve tests out of band.

**Phase 5**
> Read docs/ROADMAP.md Phase 5. Use the ui-desktop agent for undo and redo and the searchable sheet, and the content agent for challenges and scenario flasks. Phone gestures for undo go to the ui-mobile agent.

**Phase 6**
> Read docs/ROADMAP.md Phase 6. Start with 6.1 and 6.4. Do not start 6.5 unless docs/performance shows phones over budget.

## Research sources

- Glenn Fiedler, "Fix Your Timestep" — gafferongames.com
- Petri Purho, "Exploring the Tech and Design of Noita", GDC 2019
- Max Bittker, "Making Sandspiel" — maxbittker.com
- GelamiSalami, GPU-Falling-Sand-CA (Margolus blocks) — GitHub
- The Powder Toy wiki (electricity, SPRK/METL); dan-ball Powder Game (wind)
- Noita wiki, Alchemy (per-seed recipes)
- R74n, Sandboxels v1.15 release notes (undo and redo)
- MDN: Compute Pressure API, Cross-Origin-Embedder-Policy, crisp pixel art
