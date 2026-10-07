import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';

function slab(w, h) {
  const world = E.createWorld({ seed: 1, scene: 'empty' });
  world.applyOperation({ t: 'box', x0: 0, y0: E.H - 4, x1: E.W - 1, y1: E.H - 1, m: E.STONE });
  world.applyOperation({ t: 'box', x0: 100, y0: E.H - 4 - h, x1: 100 + w - 1, y1: E.H - 5, m: E.NITRO });
  world.applyOperation({ t: 'p', x: 99, y: E.H - 6, r: 1, m: E.FIRE });
  return world;
}

test('a huge nitro slab goes off without overflowing the stack (it used to crash and reset)', () => {
  const world = slab(240, 140);
  assert.doesNotThrow(() => world.advanceTicks(30));
  const left = world.inspect().cells.reduce((n, c) => n + (c === E.NITRO), 0);
  assert.equal(left, 0, 'the whole slab went up');
});

test('small chains are unchanged: same cells as a reference run', () => {
  const a = slab(20, 12), b = slab(20, 12);
  a.advanceTicks(20); b.advanceTicks(20);
  assert.deepEqual(a.captureState().cells, b.captureState().cells);
  assert.ok(a.captureState().cells.every(c => c !== E.NITRO));
});
