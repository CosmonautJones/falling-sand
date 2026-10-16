import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';
import { validateOperations } from '../public/v2/engine/checkpoint.js';
import { createWalkerState, dropWalkerIn, stepWalker } from '../public/v2/engine/walker.js';

const buffers = () => Array.from({ length: 3 }, () => new Uint8Array(E.N * 4));
const walkerContext = cells => ({
  get: (x, y) => x < 0 || y < 0 || x >= E.W || y >= E.H ? E.STONE : cells[y * E.W + x],
  bear: m => m === E.STONE,
  open: m => m === E.AIR,
});

test('a grounded walker rechecks support before idling', () => {
  const walker = createWalkerState();
  const cells = new Uint8Array(E.N);
  cells.fill(E.AIR);
  dropWalkerIn(walker, 100, 19);
  walker.phase = 'ground';
  cells[20 * E.W + 100] = E.STONE;
  const ctx = walkerContext(cells);

  stepWalker(walker, { active: true }, ctx);
  assert.equal(walker.phase, 'ground');
  cells[20 * E.W + 100] = E.AIR;
  stepWalker(walker, { active: true }, ctx);
  assert.equal(walker.phase, 'drop');
  assert.ok(walker.y > 19, 'the unsupported walker begins falling');
});

test('walker drops clamp finite coordinates inside the grid and reject nonfinite input atomically', () => {
  const walker = createWalkerState();
  dropWalkerIn(walker, 100, 999);
  assert.equal(walker.x, 100);
  assert.equal(walker.y, E.H - 2);

  for (const [x, y] of [[Number.NaN, 8], [100, Number.NaN], [Number.POSITIVE_INFINITY, 8], [100, Number.POSITIVE_INFINITY]]) {
    const invalid = createWalkerState();
    assert.throws(() => dropWalkerIn(invalid, x, y), /finite/i);
    assert.deepEqual(invalid, createWalkerState());
  }
});

test('rejected adapter operations do not apply walker commands', () => {
  for (const frame of [
    { ops: [{ t: 'unknown' }] },
    { held: { t: 'clear' } },
  ]) {
    const engine = E.createEngine({ seed: 73, scene: 'empty', weather: false });
    assert.throws(() => engine.tick({ ...frame, dt: 0, walkerCmd: { drop: { x: 100, y: 8 } } }, ...buffers()));
    assert.equal(engine.tick({ dt: 0 }, ...buffers()).walker, null);
  }
});

test('poke validation accepts one-cell axial shoves only', () => {
  assert.deepEqual(validateOperations([{ t: 'poke', x: 100, y: 100, dx: -1, dy: 0 }]),
    [{ t: 'poke', x: 100, y: 100, dx: -1, dy: 0 }]);
  for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [0, 0]]) {
    assert.throws(() => validateOperations([{ t: 'poke', x: 100, y: 100, dx, dy }]));
  }
});

test('invalid poke batches are rejected before a valid earlier poke can mutate the world', () => {
  const engine = E.createEngine({ seed: 73, scene: 'empty', weather: false });
  const sim = engine.inspect();
  sim.setc(100, 100, E.BEETLE, 0);
  const before = engine.captureState().cells;
  assert.throws(() => engine.tick({ paused: true, ops: [
    { t: 'poke', x: 100, y: 100, dx: 1, dy: 0 },
    { t: 'poke', x: 100, y: 100, dx: 1, dy: 1 },
  ] }, ...buffers()));
  assert.deepEqual(engine.captureState().cells, before);
});
