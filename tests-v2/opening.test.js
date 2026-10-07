import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';

const SPARK_TICK = 480;
const blastsWithin = (world, ticks) => {
  const out = [];
  for (let t = 1; t <= ticks; t++) for (const e of world.advanceTicks(1)) if (e.t === 'blast') out.push(t);
  return out;
};

test('the untouched charged vessel sets off a visible chain reaction inside 30 s', () => {
  const world = E.createWorld({ seed: 0xa341316c, scene: 'vessel' });
  const blasts = blastsWithin(world, 1800);
  assert.ok(blasts.length >= 1, 'a cask goes off');
  assert.ok(blasts[0] > SPARK_TICK && blasts[0] < 1800, `first blast at tick ${blasts[0]}`);
});

test('the opening chain does not melt the vessel: floor and trough survive 30 s', () => {
  const world = E.createWorld({ seed: 0xa341316c, scene: 'vessel' });
  const n = m => world.inspect().cells.reduce((a, c) => a + (c === m), 0);
  const lava0 = n(E.LAVA), water0 = n(E.WATER);
  world.advanceTicks(1800);
  assert.ok(n(E.LAVA) < lava0 * 3, `lava ${lava0} -> ${n(E.LAVA)}`);
  assert.ok(n(E.WATER) > water0 * 0.7, `water ${water0} -> ${n(E.WATER)}`);
});

test('the chain starts from a fire, not from nothing: wood burns before the casks blow', () => {
  const world = E.createWorld({ seed: 5, scene: 'vessel' });
  const sim = world.inspect();
  let firstFire = -1, firstBlast = -1;
  for (let t = 1; t <= 1800 && firstBlast < 0; t++) {
    const evs = world.advanceTicks(1);
    if (firstFire < 0 && sim.cells.includes(E.FIRE)) firstFire = t;
    if (evs.some(e => e.t === 'blast')) firstBlast = t;
  }
  assert.ok(firstFire > SPARK_TICK, 'nothing burns before the spark');
  assert.ok(firstBlast > firstFire, 'fire walks to the casks');
});

test('the opening spark is a queued command, so checkpoints carry it', () => {
  const world = E.createWorld({ seed: 3, scene: 'vessel' });
  const sparks = world.captureState().commands.filter(c => c.op.t === 'spark');
  assert.equal(sparks.length, 1);
  assert.equal(sparks[0].tick, SPARK_TICK);
  const engine = E.createEngine({ seed: 3, scene: 'vessel' });
  const saved = E.decodeCheckpoint(JSON.parse(JSON.stringify(E.encodeCheckpoint(engine.checkpoint()))));
  assert.equal(saved.state.commands.filter(c => c.op.t === 'spark').length, 1);
});

test('an empty vessel and a poured-out scene stamp are never sparked', () => {
  assert.equal(E.createWorld({ seed: 3, scene: 'empty' }).captureState().commands.length, 0);
  const world = E.createWorld({ seed: 3, scene: 'vessel' });
  world.applyOperation({ t: 'load', cells: new Uint8Array(E.N) });
  assert.equal(world.captureState().commands.filter(c => c.op.t === 'spark').length, 0);
});

test('clearing the vessel cancels a pending spark; resetting re-arms it from now', () => {
  const world = E.createWorld({ seed: 3, scene: 'vessel' });
  world.advanceTicks(100, [{ tick: 50, sequence: 0, op: { t: 'wipe', mode: 'clear' } }]);
  assert.equal(world.captureState().commands.length, 0, 'clear drops the spark');
  world.advanceTicks(1, [{ tick: 101, sequence: 0, op: { t: 'wipe', mode: 'reset' } }]);
  const sparks = world.captureState().commands.filter(c => c.op.t === 'spark');
  assert.deepEqual(sparks.map(c => c.tick), [101 + SPARK_TICK]);
  const blasts = blastsWithin(world, 1800);
  assert.ok(blasts.length >= 1, 'the reset vessel goes off again');
});

test('a spark op drops one ember and rejects bad coordinates atomically', () => {
  const world = E.createWorld({ seed: 3, scene: 'empty' });
  world.applyOperation({ t: 'spark', x: 40, y: 20 });
  assert.equal(world.inspect().get(40, 20), E.EMBER);
  assert.throws(() => world.advanceTicks(1, [{ tick: 1, sequence: 0, op: { t: 'spark', x: 'a', y: 2 } }]));
});
