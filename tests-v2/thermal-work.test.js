import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, N, W, H, STONE, WATER, FIRE, ICE, WOOD } from '../public/v2/engine/world.js';

test('resting air skips thermal source and buoyancy scans after settling', () => {
  const world = createWorld({ scene: 'empty', seed: 31 });
  world.advanceTicks(3);
  const work = world.inspect().thermalWork;
  assert.ok(work, 'thermal scan counters are observable');
  assert.equal(work.sourceCells, 0);
  assert.equal(work.buoyancyCells, 0);
  assert.ok(world.inspect().heat.every(t => t === 18));
});

test('heat and cold edits at chunk seams match a fully refreshed thermal pass', () => {
  const a = createWorld({ scene: 'empty', seed: 31 });
  a.applyOperation({ t: 'box', x0: 0, y0: H - 4, x1: W - 1, y1: H - 1, m: STONE });
  a.advanceTicks(8);
  const b = createWorld({ scene: 'empty' });
  b.restore(a.captureState());
  for (let tick = 0; tick < 48; tick++) {
    const ops = tick === 0 ? [
      { t: 'box', x0: 7, y0: 120, x1: 17, y1: 134, m: WATER },
      { t: 'box', x0: 18, y0: 126, x1: 24, y1: 133, m: WOOD },
      { t: 'p', x: 16, y: 119, r: 1, m: FIRE },
      { t: 'p', x: W - 2, y: H - 6, r: 1, m: ICE },
    ] : tick === 12 ? [{ t: 'heat', x: 15, y: 128, r: 5 }]
      : tick === 24 ? [{ t: 'cool', x: 8, y: 128, r: 6 }] : [];
    b.restore(b.captureState()); // Discard the quiet cache before the reference tick.
    for (const op of ops) { a.applyOperation(op); b.applyOperation(op); }
    a.step(); b.step();
    assert.deepEqual(a.captureState(), b.captureState(), `tick ${tick}`);
  }
  assert.ok(a.inspect().thermalWork.sourceCells < N / 4, 'remote quiet air stays skipped');
});

test('dense thermal fields and clear preserve exact checkpoint continuation', () => {
  const a = createWorld({ scene: 'empty', seed: 31 });
  a.inspect().heat.fill(100);
  const b = createWorld({ scene: 'empty' });
  b.restore(a.captureState());
  for (let tick = 0; tick < 12; tick++) {
    b.restore(b.captureState()); a.step(); b.step();
    assert.deepEqual(a.captureState(), b.captureState());
  }
  assert.equal(a.inspect().thermalWork.sourceCells, N);
  for (const world of [a, b]) { world.applyOperation({ t: 'clear' }); world.advanceTicks(3); }
  assert.deepEqual(a.captureState(), b.captureState());
  assert.equal(a.inspect().thermalWork.sourceCells, 0);
});
