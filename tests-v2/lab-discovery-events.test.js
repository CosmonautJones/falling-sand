import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/engine/world.js';
import { createRandom } from '../public/v2/engine/random.js';
import { createGrowthFixture } from './growth-fixtures.js';

function reactionWorld() {
  const world = E.createWorld({ seed: 4, scene: 'empty', weather: false, ambientEmbers: false });
  world.applyOperation({ t: 'box', x0: 0, y0: E.H - 4, x1: E.W - 1, y1: E.H - 1, m: E.STONE });
  world.applyOperation({ t: 'box', x0: 100, y0: E.H - 30, x1: 380, y1: E.H - 5, m: E.SAND });
  world.applyOperation({ t: 'box', x0: 100, y0: E.H - 40, x1: 380, y1: E.H - 31, m: E.FIRE });
  return world;
}

function singleGlassWorld() {
  const world = E.createWorld({ seed: 1, scene: 'empty', weather: false, ambientEmbers: false });
  const sim = world.inspect();
  world.setGravity({ x: 0, y: 0 });
  sim.setc(101, 100, E.SAND, 0);
  sim.setc(101, 101, E.FIRE, 0);
  return world;
}

function firstZeroSeed(bound) {
  for (let seed = 0; ; seed++) if (createRandom(seed).int(bound) === 0) return seed;
}

test('lab discovery channel reports created materials even when visual tx events are sampled', () => {
  const world = singleGlassWorld();
  const events = world.advanceTicks(1);
  const discoveries = world.takeDiscoveries();
  assert.equal(events.some(event => event.t === 'tx' && event.m === E.GLASS), false, 'visual tx sampling misses this real creation');
  assert.deepEqual(discoveries, [{ m: E.GLASS, x: 101, y: 100 }], 'the provenance channel still reports it');
  assert.ok(discoveries.every(event => Number.isInteger(event.x) && Number.isInteger(event.y)));
  assert.deepEqual(world.takeDiscoveries(), [], 'draining the channel is idempotent');
});

test('a transient product remains discoverable after it is consumed before the host drains', () => {
  const world = singleGlassWorld();
  world.advanceTicks(1);
  world.inspect().setc(101, 100, E.AIR, 0);
  assert.deepEqual(world.takeDiscoveries(), [{ m: E.GLASS, x: 101, y: 100 }]);
});

test('direct painting and seeded setup cells do not count as discoveries', () => {
  const world = E.createWorld({ seed: 7, scene: 'empty', weather: false, ambientEmbers: false });
  world.inspect().setc(20, 20, E.GLASS, 0);
  world.applyOperation({ t: 'box', x0: 30, y0: 30, x1: 32, y1: 32, m: E.COPPER });
  world.applyOperation({ t: 'spark', x: 40, y: 40 });
  world.applyOperation({ t: 'font', x: 50, y: 50, m: E.SAND });
  world.inspect().setc(60, 60, E.FONT, E.GLASS);
  world.advanceTicks(1);
  world.applyOperation({ t: 'load', cells: new Uint8Array(E.N).fill(E.COPPER) });
  assert.deepEqual(world.takeDiscoveries(), []);
  assert.deepEqual(E.createWorld({ seed: 8, scene: 'vessel', weather: false, ambientEmbers: false }).takeDiscoveries(), [], 'seeded minnow and vessel contents are observations, not creations');
});

test('discovery notifications are derived and cleared by reset and restore', () => {
  const world = reactionWorld();
  world.advanceTicks(3);
  const saved = world.captureState();
  assert.ok(world.takeDiscoveries().length > 0);
  world.advanceTicks(1);
  world.reset({ seed: 9, scene: 'empty' });
  assert.deepEqual(world.takeDiscoveries(), []);
  world.restore(saved);
  assert.deepEqual(world.takeDiscoveries(), [], 'checkpoint state does not replay already-drained discoveries');

  const pending = singleGlassWorld();
  pending.advanceTicks(1);
  const pendingState = pending.captureState();
  pending.restore(pendingState);
  assert.deepEqual(pending.takeDiscoveries(), [], 'restore clears an undrained transient');
});

test('native mud hatching records a MITE discovery', () => {
  const world = createGrowthFixture(E, { scene: 'crowded', seed: 2026 });
  const sim = world.inspect();
  sim.setc(209, 229, E.AIR, 0); sim.setc(211, 229, E.AIR, 0);
  const state = world.captureState();
  state.random.ecology = firstZeroSeed(E.ECOLOGY.mudHatch);
  world.restore(state);
  assert.deepEqual(world.takeDiscoveries(), [], 'fixture contents are seeded observations');
  world.advanceTicks(1);
  assert.ok(world.takeDiscoveries().some(event => event.m === E.MITE), 'wet mud hatches a discoverable mite');
});

test('draining discoveries never changes deterministic simulation state', () => {
  const observed = reactionWorld(), quiet = reactionWorld();
  for (let tick = 0; tick < 6; tick++) {
    observed.advanceTicks(1);
    observed.takeDiscoveries();
    quiet.advanceTicks(1);
  }
  assert.deepEqual(observed.captureState(), quiet.captureState());
});
