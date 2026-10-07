import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, W, H, N, AIR, SAND, STONE } from '../public/v2/engine/world.js';
import { createRandom } from '../public/v2/engine/random.js';

const box = (world, x0, y0, x1, y1, m) => world.applyOperation({ t: 'box', x0, y0, x1, y1, m });

test('empty ambient regions need no cell or thermal updates', () => {
  const world = createWorld({ scene: 'empty', seed: 21 });
  world.step();
  assert.equal(world.inspect().activity.cellVisits, 0);
  assert.equal(world.inspect().activity.thermalCells, 0);
  assert.ok(world.inspect().cells.every(m => m === AIR));
  assert.ok(world.inspect().heat.every(t => t === 18));
});

test('supported sand sleeps without changing its random sequence or grain payloads', () => {
  const world = createWorld({ scene: 'empty', seed: 21 });
  box(world, 0, H - 1, W - 1, H - 1, STONE);
  box(world, 0, H - 4, W - 1, H - 2, SAND);
  const before = world.captureState();
  world.step();
  const after = world.captureState();
  assert.deepEqual(after.cells, before.cells);
  assert.deepEqual(after.shades, before.shades);
  assert.ok(after.VX.every(v => v === 0) && after.VY.every(v => v === 0));
  const reference = createRandom(21);
  for (let i = 0; i < W * 3; i++) reference.int(2);
  assert.equal(after.random.physical, reference.captureState(), 'sleep preserves the original blocked-slide draws');
  assert.ok(world.inspect().activity.cellVisits < N / 4, 'idle sand avoids the full cell sweep');
});

test('erasing support at a chunk seam wakes the grain on the next tick', () => {
  const world = createWorld({ scene: 'empty', seed: 21 });
  box(world, 7, 151, 9, 151, STONE);
  world.inspect().setc(8, 150, SAND, 7);
  world.advanceTicks(3);
  assert.equal(world.inspect().get(8, 150), SAND);
  box(world, 7, 151, 9, 151, AIR);
  world.step();
  assert.equal(world.inspect().get(8, 151), SAND);
  assert.equal(world.inspect().shades[151 * W + 8], 7);
  assert.equal(world.inspect().cells.filter(m => m === SAND).length, 1);
});

test('supported grains normalize signed-zero velocities as an ordinary step does', () => {
  const world = createWorld({ scene: 'empty', seed: 21 });
  box(world, 7, 151, 9, 151, STONE);
  const sim = world.inspect(), i = 150 * W + 8;
  sim.setc(8, 150, SAND, 7);
  sim.VX[i] = -0; sim.VY[i] = -0;
  world.step();
  assert.ok(Object.is(sim.VX[i], 0) && Object.is(sim.VY[i], 0), 'checkpoint float bits keep the ordinary normalization');
});

test('restoring a quiet checkpoint rebuilds activity before heat and movement resume', () => {
  const a = createWorld({ scene: 'empty', seed: 21 });
  box(a, 0, H - 1, W - 1, H - 1, STONE);
  box(a, 0, H - 4, W - 1, H - 2, SAND);
  a.advanceTicks(4);
  const b = createWorld({ scene: 'empty', seed: 99 });
  b.restore(a.captureState());
  for (const world of [a, b]) {
    world.applyOperation({ t: 'heat', x: 8, y: H - 3, r: 2 });
    box(world, 7, H - 1, 9, H - 1, AIR);
    world.advanceTicks(10);
  }
  assert.deepEqual(a.captureState(), b.captureState());
});

test('clearing a dense hot world immediately returns to idle updates', () => {
  const world = createWorld({ scene: 'empty', seed: 21 });
  world.inspect().heat.fill(100);
  world.step();
  assert.equal(world.inspect().activity.thermalCells, N);
  world.applyOperation({ t: 'clear' });
  world.step();
  assert.equal(world.inspect().activity.cellVisits, 0);
  assert.equal(world.inspect().activity.thermalCells, 0);
});

test('dense and sparse update paths produce the same checkpoint continuation', () => {
  const a = createWorld({ scene: 'empty', seed: 21 });
  box(a, 0, H - 1, W - 1, H - 1, STONE);
  box(a, 0, H - 4, W - 1, H - 2, SAND);
  a.inspect().heat.fill(100);
  a.step(); // Select the dense path, then make the same authoritative state quiet.
  a.inspect().heat.fill(18);
  const b = createWorld({ scene: 'empty', seed: 99 });
  b.restore(a.captureState());
  a.step(); b.step();
  assert.equal(a.inspect().activity.cellVisits, N);
  assert.equal(b.inspect().activity.cellVisits, 0);
  assert.deepEqual(a.captureState(), b.captureState());
});
