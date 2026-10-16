import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';

function pond(seed = 9) {
  const w = E.createWorld({ seed, scene: 'empty' });
  const box = (x0, y0, x1, y1, m) => w.applyOperation({ t: 'box', x0, y0, x1, y1, m });
  box(0, E.H - 4, E.W - 1, E.H - 1, E.STONE);
  box(99, 200, 99, E.H - 5, E.STONE); box(301, 200, 301, E.H - 5, E.STONE);
  box(100, 230, 300, E.H - 5, E.WATER);
  w.inspect().setc(200, 229, E.SEED, 0);
  return w;
}
const count = (w, m) => w.inspect().cells.reduce((n, c) => n + (c === m), 0);

test('seeded ponds keep their early growth and water-retention bands across fixed seeds', () => {
  let plants = 0;
  for (const seed of [4, 9, 17]) {
    const w = pond(seed), water0 = count(w, E.WATER);
    w.advanceTicks(600);
    const n = count(w, E.PLANT); plants += n;
    assert.ok(n >= 10, `seed ${seed} establishes plants (${n})`);
    assert.ok(count(w, E.WATER) > water0 * 0.6, `seed ${seed} retains most of its pond`);
  }
  // Before the cycle update these seeds totaled 101 plant grains (13–47 each).
  // New ecological draws change individual trajectories; keep the aggregate near that baseline.
  assert.ok(plants >= 80 && plants <= 125, `early growth stays near its measured baseline (${plants})`);
});

test('a wet thicket still opens blooms and drops seeds', () => {
  const w = pond(4);
  w.advanceTicks(1800);
  assert.ok(count(w, E.BLOOM) + count(w, E.SEED) > 0);
});
