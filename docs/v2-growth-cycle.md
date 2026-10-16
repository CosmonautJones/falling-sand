# V2 native growth cycle

The browser V2 native ecology now has a bounded local cycle: water supports
plants, plants and blooms can decay, freshwater-fed mud can create new seeds or
mites, and mites continue their existing feeding behavior. The cycle preserves
the V2 feel and runs only when the world uses native vegetation.

## Behavior

- Plant moisture comes from adjacent `WATER`, or from adjacent `MUD` that also
  touches `WATER`. Dry `ASH` no longer irrigates a plant.
- Existing `SEED` beside any `MUD` still germinates as the short alchemical
  sprout. It does not create sustained expansion through dry ground.
- Existing `ASH + WATER → MUD` remains unchanged.
- Exposed `MUD` means any adjacent `AIR`, not specifically the cell above. If
  that mud also touches `WATER` and is beside `PLANT` or `BLOOM`, the mud cell
  can spend itself to become a `MITE` while fewer than three neighboring cells
  contain mites. Otherwise, it can spend itself to become a `SEED`.
- Native feeding births now check the parent's neighboring mites before a birth and consume food
  as before. Existing root-nest behavior, gold and mud cargo spill, heat, ice,
  and timing rules are unchanged.
- Managed V3 vegetation keeps its existing feeding behavior; the new native
  cycle is guarded off for that mode.

## Rates and implementation boundary

`ECOLOGY` is a small table in `public/v2/engine/world.js`. Its values are
nominal expected-tick averages while an event is eligible, not countdown timers:

| Event | Expected ticks | Approximate average |
|---|---:|---:|
| Dry plant or bloom decay | 3,600 | 60 s |
| Wet plant or bloom decay | 36,000 | 600 s |
| Freshwater-fed mud to seed | 600 | 10 s |
| Food-backed mud to mite | 240 | 4 s |
| Native neighboring-mite birth threshold | 3 | source/parent neighborhood |

Plant decay runs inside the existing one-in-five growth gate, with its odds
divided by five to retain the nominal average. `BLOOM` decay is checked
tickwise and uses the native-only wake guard.

Mud checks hatching before seeding, so a successful hatch preempts that seed
attempt. Changing moisture, exposure, food or competing reactions changes the
observed waiting time. The mite threshold checks eight cells around the source
mud or feeding parent before birth; it is not a global population cap or a
guarantee that every neighborhood contains at most three mites.

The growth-cycle change adds no material IDs, checkpoint arrays, save-format changes, or
new physics framework. Existing saves remain readable, although future
outcomes can differ because ecology draws are part of the simulation.

The integrated October 15 explorer update separately appended beetle/newt IDs
53/54. Its helper remains session-only and is not included in flask saves. This
release preserves those additions and fixes support loss, rejected-input
atomicity, finite drop bounds and the one-cell axial poke contract.

## Verification recorded

The legacy pond check now covers seeds `4`, `9`, and `17`; each must establish
at least 10 plants, retain more than 60% of its starting water, and keep the
aggregate plant count in the measured `80..125` band. Its earlier ten-second
plant total was `41 + 47 + 13 = 101`; the current candidate is `28 + 28 + 34 =
90`.

The comparison baseline is main commit
`c67a4a199f46e9454161e6191f486f349dcf6dec`, including the explorer, beetles and
newts. Growth fixture version 3 uses a continuous shelf so mud remains exposed
to water and air after settling. Earlier fixtures that let the mud sink are
excluded from the results. Both versions use identical geometry, seeds
`73, 991, 2026`, 60 Hz ticks, no weather and no ambient embers.

| At 120 simulated seconds | Main baseline | Growth cycle |
|---|---:|---:|
| Dry plants + blooms, initially 588 | 588 / 588 / 588 | 88 / 79 / 77 |
| Dry ash, initially 0 | 0 / 0 / 0 | 500 / 509 / 511 |
| Shore plants, initially 0 | 0 / 0 / 0 | 91 / 147 / 185 |
| Shore blooms, initially 0 | 0 / 0 / 0 | 21 / 22 / 20 |
| Shore mites, initially 0 | 0 / 0 / 0 | 0 / 12 / 0 |
| Shore water, initially 6,118 | 6,118 / 6,118 / 6,118 | 6,094 / 6,043 / 6,089 |

The dry fixture conserves its occupied-cell count as living grains become ash.
That is a local test invariant, not a whole-ecosystem conservation claim. The
shore starts with eight mud grains and no seeds, plants, blooms or mites; it
establishes growth without a painted seed. Upstream newt spawning still runs:
the baseline has 15/16/14 newts at 120 seconds, versus 8/7/2 in the candidate.
Changed ecology random draws and consumed mud change individual trajectories.

Local validation passed 452 tests: the full 241-test V2 suite plus six focused
feeding-cap cases, 168 original-game tests and 37 V3 tests.
Lint, typecheck and production build passed. Independent review found no
unresolved concrete defect. Focused regressions cover dry ash, settled blooms,
natural wet-mud growth, source-consuming/crowded births, cargo, staged residue
transitions, managed-mode isolation, checkpoint continuation and the explorer.

For an explicit soak profile, use the checked-in script:

```bash
node scripts/profile-growth.mjs --seeds 73,991,2026 --seconds 120 --sample-seconds 10 --scene all
```

The explicit ten-minute shore soak used the same three seeds and sampled once
per simulated minute:

| At 600 simulated seconds | Seed 73 | Seed 991 | Seed 2026 |
|---|---:|---:|---:|
| Plants | 274 | 284 | 462 |
| Blooms | 28 | 45 | 33 |
| Mites | 36 | 20 | 47 |
| Ash | 174 | 201 | 257 |
| Mud | 739 | 561 | 621 |
| Water remaining / 6,118 | 5,263 | 5,725 | 5,886 |
| Highest minute-sampled mite count | 49 | 28 | 47 |

All three ended the horizon with nonzero growth and mites, with 86–96% of their
starting water. Mites appeared later than plants, rather than being present at
every sample. This is finite-window balance evidence: populations still
fluctuate and mud accumulates, so these runs do not establish an equilibrium or
rule out a later resource crash. The separate 240-second finite-garden test
requires an initial colony boom followed by decline as its water/food run out.

The [recorded profiles and host benchmark](performance/v2-growth-20261016.json)
include initial counts, per-sample counts/state hashes, runtime, fixture and all
engine-module hashes. Population-profile step timings were collected alongside
other checks and are excluded from performance claims.

## Simulation cost on this Windows desktop

Five alternating A/B rounds used the four existing benchmark scenes, default
seed `0xa341316c`, 120 warmup ticks and 600 timed ticks per trial. Values below
are medians of the five per-trial nearest-rank percentiles, on a Ryzen 7 5800X,
Node 22.16.0 / V8 12.4, Windows x64.

| Scene | Main p50 ms | Cycle p50 ms | Change | Main p99 ms | Cycle p99 ms |
|---|---:|---:|---:|---:|---:|
| Settled | 2.270 | 2.324 | +2.4% | 4.281 | 3.908 |
| Falling | 4.068 | 3.984 | −2.0% | 6.596 | 7.221 |
| Wet | 3.689 | 3.724 | +1.0% | 7.304 | 7.447 |
| Storm | 10.120 | 10.480 | +3.6% | 16.725 | 16.169 |

All scenes pass the roadmap's 10% median-step regression gate. Measured
candidate simulation capacity was approximately 404/233/250/95 ticks per
second, versus 402/234/252/97 on main. This times only simulation steps;
rendering, worker transport, input, saves and hashing are excluded. Different
population trajectories affect cost. These host measurements do not establish
phone performance, browser FPS or worst-case frame spikes.

To reproduce the exact comparison from the repository root in PowerShell:

```powershell
New-Item -ItemType Directory -Force qa-shots/growth/main-baseline
git archive --format=tar -o qa-shots/growth/main-baseline-source.tar c67a4a199f46e9454161e6191f486f349dcf6dec public/v2 tests-v2/fixtures.js package.json
tar -xf qa-shots/growth/main-baseline-source.tar -C qa-shots/growth/main-baseline
node docs/performance/v2-growth-bench-20261016.mjs
node scripts/profile-growth.mjs --seeds 73,991,2026 --seconds 600 --sample-seconds 60 --scene shore
```

## Limits and compatibility

The fixtures are finite, bounded scenes, and the ecology uses probability
averages rather than guaranteed event times. Exact replay is expected only with
the same engine version and runtime. Save readability is preserved, but replay
outcomes may change as the new ecology draws run. The existing WebGPU work is
still pending, and the native Godot project has not been ported into this cycle.

This is an alchemical game ecosystem, not a mass- or energy-conserving biology
model. Plants can create living cells in air, feeding can remove food, and
inherited newt spawning can add an animal beside mud. The new mud-to-seed/mite
paths spend their source cell; that local rule does not establish conservation
for the whole vessel. Finite water or food can run out and a colony can collapse.
