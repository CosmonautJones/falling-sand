# Habitat reliability after d31e726

Approved scope: fix the reviewed regressions, verify the opening vessel, and commit.

1. Reproduce occupied sky replacement, stalled diagonal ignition, global garden aging, and moss consuming fired walls with failing tests.
2. Keep rain rites inside available sky cells; remove unsolicited periodic embers. Heating remains an intentional experiment.
3. Add direct flame contact heating without instant first-contact ignition. Preserve the existing kiln reactions.
4. Track consecutive locally nourished steps per plant/moss grain. Moss reaches sand after 1800 steps, plant after 3600, and plant may reach unprotected water after 5400. Drying resets maturity; new growth starts young. Brick is never a moss host.
5. Verify growth state moves and resets with grains. Keep global beats for observation only. Update the material descriptions.
6. Run regressions, full tests, lint and build; watch the live 480×270 opening beyond the old 45-second ember trigger and check input gestures. Commit only after recording outcomes.

This fixes reliability; Adobe, donor topology, save/replay, and lightning remain later milestones. Future save/replay must include local growth maturity along with the existing grain state.

## Evidence

- Observed red before implementation: both rain regressions, diagonal Plant and Wood ignition, Brick persistence, fresh-garden maturity, moisture interruption, and growth-state lifecycle. Replaced the two old global-age sand-growth tests with local-condition regressions.
- `npm test`: 186/186 passed across 12 files. This includes the existing three-seed, 1800-step opening nursery checks and a 480×270 fired-wall fixture run for 1860 steps. The wall retains all nine Brick grains at their original coordinates.
- `npm run lint`, `npm run build`, and `git diff --check` passed. Vite still reports the existing bundle-size warning (553.55 kB uncompressed).
- Live Vite browser, 480×270, normal speed: observed for 115.19 seconds / 6592 displayed beats after a clean reload. Input logging recorded zero viewport pointer-down events. At 26.07, 72.16 and 115.19 seconds: Lava 81, Water 1367, Sand 994, Plant 3, four Mites, both original nursery Mud cells present, zero changed enclosure cells, and zero Lava grains outside the cup. Mite positions changed across samples; this does not establish successful construction or eliminate huddling.
- Inspected opening and extended screenshots. Local evidence is under ignored `qa-shots/habitat-reliability/`. The first capture contained a stray sand stroke and was discarded; the accepted run began with 994 Sand and zero recorded inputs. Browser connection initially timed out, then recovered after closing and reopening the test page.
- Live controls after the hands-off run: left click added 113 Sand grains, right click named Sand, wheel zoom worked, and right drag changed the view translation by (80, 30) without changing grain count.
- Browser console: zero errors; the existing 12 AudioContext autoplay warnings occurred before interaction. The HUD sampled 47, 19 and 60 fps, with about 57 simulation steps per second across the run. No claim of a stable frame-time budget.

The reliability regressions are addressed. The opening is still sparse, with no new construction or discovery loop added here. This is not acceptance of the complete Living Retort experience.
