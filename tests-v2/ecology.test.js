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

test('one seed greens a pond but does not pave it over within 10 seconds', () => {
  const w = pond();
  const water0 = count(w, E.WATER);
  w.advanceTicks(600);
  assert.ok(count(w, E.PLANT) > 40, `plants grew: ${count(w, E.PLANT)}`);
  assert.ok(count(w, E.WATER) > water0 * 0.6, `most of the pond is still water: ${count(w, E.WATER)} of ${water0}`);
});

test('a wet thicket still opens blooms and drops seeds', () => {
  const w = pond(4);
  w.advanceTicks(1800);
  assert.ok(count(w, E.BLOOM) + count(w, E.SEED) > 0);
});
