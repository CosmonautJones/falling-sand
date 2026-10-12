import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, W, H, STONE, WOOD, BRICK, FIRE, WATER } from '../public/v2/engine/world.js';
import { hashState } from '../scripts/bench-v2.mjs';

function restingMixture() {
  const world = createWorld({ scene: 'empty', seed: 31 });
  // All three materials rest at 18, including at mixed chunk boundaries.
  // Alternating vertical strips also exercise the partial bottom chunk.
  for (let x = 0; x < W; x++) world.applyOperation({
    t: 'box', x0: x, y0: 0, x1: x, y1: H - 1,
    m: [STONE, WOOD, BRICK][x % 3],
  });
  return world;
}

test('resting material mixtures skip thermal work without changing their state', () => {
  const world = restingMixture();
  const before = world.captureState();
  world.advanceTicks(4);
  const after = world.captureState();
  assert.ok(after.cells.every((m, i) => m === before.cells[i]), 'the resting structure stays put');
  assert.ok(after.heat.every(t => t === 18), 'every material keeps its resting heat');
  assert.equal(world.inspect().thermalWork.sourceCells, 0);
  assert.equal(world.inspect().thermalWork.buoyancyCells, 0);
});

test('heat, cold and material edits wake cached mixtures with exact continuation', () => {
  const cached = restingMixture();
  cached.advanceTicks(4);
  const refreshed = createWorld({ scene: 'empty' });
  refreshed.restore(cached.captureState());
  for (let tick = 0; tick < 36; tick++) {
    refreshed.restore(refreshed.captureState()); // Discard all thermal cache state.
    const ops = tick === 0 ? [{ t: 'heat', x: 8, y: H - 8, r: 5 }]
      : tick === 10 ? [{ t: 'cool', x: 16, y: H - 3, r: 6 }]
      : tick === 20 ? [
        { t: 'p', x: W - 1, y: 0, r: 2, m: FIRE },
        { t: 'p', x: 7, y: 7, r: 3, m: WATER },
      ] : [];
    for (const world of [cached, refreshed]) for (const op of ops) world.applyOperation(op);
    cached.step(); refreshed.step();
    assert.equal(hashState(cached.captureState()), hashState(refreshed.captureState()), `tick ${tick}`);
  }
});
