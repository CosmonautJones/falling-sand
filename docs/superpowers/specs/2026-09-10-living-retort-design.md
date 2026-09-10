# The Living Retort

Approved product direction for Alembic, 2026-09-10.

**Promise:** I noticed something strange, tried an idea, and now this little world is different.

**Milestone:** One compelling ten-minute session that invites another experiment. Replayability comes from understandable interactions, different outcomes and attachment to a vessel. Endless play is an ambition, not a completion claim.

## Experience

Notice a possibility, change a local condition, watch a consequence, investigate it, then keep or retry the result. The vessel should be interesting both while the player pours and after they let go. Permanent material changes make its history visible.

The opening landscape contains three legible invitations that share a world rather than appearing as labeled demonstrations or puzzle rooms:

| Invitation | Intervention | Intended consequence |
| --- | --- | --- |
| Mites between vegetation and a loose deposit | Supply material or change access | Construction changes routes and creates a structure the player cares about |
| Crystal near a pool with minnows | Change shoreline or water contact | A changed habitat gathers activity and can leave a pearl |
| Sand beside contained heat | Open a route toward the heat | A persistent glass formation records that route |

A supported metal formation and vapor become a fourth invitation only after the discharge contract is proven. These targets should not require unexplained exact-pixel arrangements. Typed rites remain optional bonuses.

## First complete cycle

Mites build supported Adobe. The player introduces heat. Adobe fires into Brick. Survivors continue to move and build around the changed terrain.

This connects life, chemistry, architecture and history. Acceptance depends on sustained activity and distinct outcomes after different interventions, not counting a new material once.

### Construction decisions

- Wet Mud remains powder. Preserve nursery mud and adjacent forage.
- One mud cargo becomes one Adobe grain. Do not consume neighboring sand or mud to cement it.
- Adobe is a separate static material, absent from STARTER and TRANSMUTED palette lists. Right-click names it honestly; sampling must not turn it into a hidden construction brush.
- Fire turns Adobe into existing Brick. Cold construction must not create Brick.
- Placement eligibility is separate from scoring. Forbidden candidates are excluded; no eligible candidate means cargo is retained.
- Explore N8 two/three wall-neighbor preference in drop scoring only. Define wall materials and direct load-bearing support explicitly. Never count liquids, creatures or out-of-bounds reads as a foundation.
- Preserve gold/mud cargo exclusion, spilling on death and ordinary pickup behavior. Add Adobe to clinging where necessary.
- A preferred score is not proof of vertical growth or open doorways. Require morphology and accessibility evidence before accepting the rule.
- Supply a small supported donor deposit separate from the nursery when construction is introduced. Prove it is reachable and actually used. Do not add it to the initial floor-only repair.

### Spectacle decisions

Generalize the rod-triggered reaction into a bounded connected air discharge using Fire and existing ignition reactions. Do not import detonate's radial deletion behavior. Specify length, obstacles, trigger consumption and retrigger eligibility before implementation.

A local discharge is an alchemical rule, not a realistic electrical field model. Steam and Aether, supported Gold and Lead, long-channel kick, preserved metal inventory and visibility across batched simulation steps all need tests.

The accepted signature is mites rebuilding around a persistent glass scar in actual Sand. A one-cell gold cap is not a six-cell rod. An air walk cannot excavate solid cob. Adobe firing produces Brick, not Glass. A gold-capped mound becoming a glass chimney is not promised by this milestone.

## Visual direction

Keep dark glass, brass, mineral colors and crisp grains. Compose silhouettes and negative space before adding effects. Dunes, irregular earthen walls, pools and crystal formations must read at the default opening scale.

- Creatures remain distinguishable in motion and when carrying cargo against Sand and Adobe.
- Heat and discharge light their immediate setting; quiet terrain stays quiet.
- Slow movement gives sudden events significance. No continuous flash, shake or sparkle blanket.
- Glass seams, fired walls and displaced material record prior experiments.
- Refine existing heat haze, caustics and gold sparkle rather than replace the renderer.
- Verify actual presentation, fallback rendering and reduced motion. An RGBA buffer alone is not visual QA.

## Discovery and keeping a vessel

Extend the existing codex with a small number of observations, emitted only when the relevant simulation action actually occurs. Examples: a mite carries gold, an earthen wall is fired, a minnow leaves a pearl, a discharge marks Sand. Atmospheric wording is followed by a plain explanation. Do not invent causal explanations from nearby occupancy alone.

Material discovery and behavioral observations are different. A seeded material is not evidence that the player caused its reaction. Avoid toast floods, task lists, scores or a mandatory recipe checklist.

Add one local vessel checkpoint with restore after the core cycle works. Restore must reproduce continued simulation, including material, shade, temperature, trails, local growth maturity, RNG and scan state, with compatible discovery state. Validate saved versions and dimensions before replacing a running vessel; corrupt data must leave the current vessel intact. Report storage failure plainly. No account, server or cloud dependency.

Broader vessel generation, galleries and multiple save slots follow evidence that players want to repeat the first experience. They are outside this milestone.

## Global constraints

- Keep animation driven by step(grid) on a 480x270 grid.
- Left pours, right names, right-drag pans; retain zoom, pause and speed controls.
- TDD for behavior changes; run the actual simulation in tests.
- No A*, colony ids, jobs, named rooms, trail/charge visor, engine rewrite or extra life-palette buttons.
- No Lightning material or Spark starter reagent. No scent-like electrical charge field.
- No pickup-density redesign, scripted sand tunnels or generic dashboard UI.
- No new runtime dependency without a demonstrated need.
- Preserve unrelated files, council artifacts and existing worktrees.
- A passing test suite is not live QA. Distinguish implemented, headless-verified and browser-verified claims.

## Delivery order and proof boundaries

| Slice | Deliverable | Acceptance | Status at approval |
| --- | --- | --- | --- |
| 1a | Opening foundation repair | Nursery stays supported and retains adjacent forage; 30-second browser observation | First executable plan |
| 1b | Donor supply and living habitat | Spare material is reachable without consuming the nursery; movement continues | Follows foundation evidence |
| 2 | Adobe and firing | Static walls, vertical growth, accessible routes, inventory balance and post-fire activity | Direction approved; implementation follows measured morphology |
| 3 | Composed landscape and presentation | Three legible invitations, readable creatures and persistent consequences | Follows core construction cycle |
| 4 | Observations and one checkpoint | Truthful records; exact restore; safe storage failure | Follows cycle and composition |
| 5 | One spectacular discharge | Visible connected channel, obstacle respect, no repeated pulse, persistent scar and rebuilding | Last, after the quieter world is rewarding |

Write a bounded executable plan per slice. Do not pre-implement later subsystems to make an early fixture pass. Ordinary implementation choices within this approved direction may proceed without another product approval; material changes to the promise or constraints require discussion.

## Evidence from the reviewed baseline

Baseline: 6d64bcc3af8212b9208acebe3af9f24af602c710.

- world.ts paints the floor first and then circles through it. Grid.paint overwrites occupied cells. At 480x270 with seed 7, nursery Mud falls from (131,264)/(132,264) to y=269 by step 10. Plant and Bloom are both absent by step 900. isNestForage protects plants only while Mud remains adjacent.
- A 20-grain Mud column kept all its grains while slumping from twenty cells high to four. Count conservation is not shape preservation.
- An enclosed six-Gold rod with Steam produced no strike; Aether produced five Gold and one Fire. The old strike consumes a metal grain.
- The opening seed has two nursery Mud grains and no Gold. In runs using seeds 1, 7 and 42, sampled states through 1800 steps showed no mud carriers or Brick. A construction rule needs a usable supply.
- main.ts can step three times before drawing. Birth-step Fire does not guarantee a displayed flash.

These were headless probes, not live-browser acceptance. Committed regression tests and slice evidence supersede probes as work lands.

## Milestone acceptance

Observe an untouched opening vessel for 30 seconds at 1x, then play for ten minutes. Record wall time and simulation progress separately. A new player should notice an invitation without instructions, make three distinct interventions, discover a connection and want to keep or retry a result. This last criterion needs a real play session; automated tests cannot certify fun.

Do not accept the milestone if the nursery strips, huddles freeze despite available exits, construction becomes pavement or sealed prisons, loaded mites disappear against terrain, one vapor pulse causes a flash loop, the scar disappears, controls regress, or the ten-minute world runs out of meaningful activity. Record failures rather than tuning seeds to hide them.

Use fixed seeds 1, 7 and 42 for deterministic long-form regressions, plus the normal opening browser state. Preserve grains plus cargo in closed nonreactive fixtures; assert allowed chemistry explicitly in reactive fixtures. Check component height, coordinate persistence and test-side air connectivity for structures. Do not add pathfinding to the runtime.

## Current work

Start with [the opening-foundation plan](../plans/2026-09-10-opening-foundation.md). Track execution and live evidence there. This brief records the approved direction, not a claim that The Living Retort has shipped.
