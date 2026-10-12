import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, N, W, H, STONE, MITE } from '../public/v2/engine/world.js';
import { hashState } from '../scripts/bench-v2.mjs';

function trailWorld(points) {
  const world = createWorld({ scene: 'empty', seed: 19 });
  world.applyOperation({ t: 'box', x0: 0, y0: 0, x1: W - 1, y1: H - 1, m: STONE });
  const state = world.captureState();
  for (const [x, y, value] of points) state.trails[y * W + x] = value;
  state.trailsLive = true;
  world.restore(state);
  return world;
}

test('a local scent diffuses and fades exactly without scanning the whole field', () => {
  const world = trailWorld([[120, 80, 255]]);
  world.step();
  const { trails, trailWork } = world.inspect();
  assert.equal(trails[80 * W + 120], 52);
  for (const i of [80 * W + 119, 80 * W + 121, 79 * W + 120, 81 * W + 120]) assert.equal(trails[i], 47);
  assert.equal(trails.reduce((sum, t) => sum + t, 0), 240);
  assert.equal(trailWork?.diffusionCells, 9);
  world.step();
  assert.equal(trails[80 * W + 120], 46);
  assert.equal(trailWork.diffusionCells, 25);
});

test('scent at a corner uses the same reflective boundary and stays bounded', () => {
  const world = trailWorld([[0, 0, 255]]);
  world.step();
  const { trails, trailWork } = world.inspect();
  assert.equal(trails[0], 148);
  assert.equal(trails[1], 47);
  assert.equal(trails[W], 47);
  assert.equal(trails.reduce((sum, t) => sum + t, 0), 242);
  assert.equal(trailWork?.diffusionCells, 4);
});

test('restore and clear cannot resurrect stale scent outside a smaller field', () => {
  const used = trailWorld([[2, 2, 255], [W - 3, H - 3, 255]]);
  used.advanceTicks(3);
  const reference = trailWorld([[120, 80, 255]]);
  used.restore(reference.captureState());
  used.inspect().scratch.trailOut.fill(127);
  used.step(); reference.step();
  assert.equal(hashState(used.captureState()), hashState(reference.captureState()));
  used.applyOperation({ t: 'clear' }); used.step();
  assert.ok(used.inspect().trails.every(t => t === 0));
  assert.equal(used.inspect().trailWork?.diffusionCells, 0);
});

test('new mites deposit scent outside an old trail and dense fields keep exact continuation', () => {
  const used = trailWorld([[2, 2, 255]]);
  used.step();
  used.inspect().setc(W - 3, H - 3, MITE, 0); // Fully enclosed, so it cannot walk.
  used.step();
  assert.ok(used.inspect().trails[(H - 3) * W + W - 3] > 0);
  const state = used.captureState();
  state.trails.fill(255); state.cells.fill(STONE); state.trailsLive = true;
  used.restore(state); used.step();
  assert.ok(used.inspect().trails.every(t => t === 244));
  assert.equal(used.inspect().trailWork?.diffusionCells, N);
});
