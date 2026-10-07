import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';

const FLOOR = E.H - 4;
function world(seed = 3) {
  const w = E.createWorld({ seed, scene: 'empty' });
  w.applyOperation({ t: 'box', x0: 0, y0: FLOOR, x1: E.W - 1, y1: E.H - 1, m: E.STONE });
  return w;
}
const box = (w, x0, y0, x1, y1, m) => w.applyOperation({ t: 'box', x0, y0, x1, y1, m });
const count = (w, m) => w.inspect().cells.reduce((n, c) => n + (c === m), 0);
function surface(w, x0, x1, m) {
  const s = w.inspect();
  for (let y = 0; y < E.H; y++) for (let x = x0; x <= x1; x++) if (s.get(x, y) === m) return y;
  return E.H;
}

test('communicating vessels: a U-tube levels both arms and conserves water', () => {
  const w = world();
  // Two 10-wide arms joined by a 3-high channel under a dividing wall.
  box(w, 99, 150, 99, FLOOR - 1, E.STONE); box(w, 132, 150, 132, FLOOR - 1, E.STONE);
  box(w, 110, 150, 120, FLOOR - 4, E.STONE);
  box(w, 100, 170, 109, FLOOR - 1, E.WATER); box(w, 110, FLOOR - 3, 120, FLOOR - 1, E.WATER);
  const n = count(w, E.WATER);
  const before = surface(w, 121, 131, E.WATER);
  w.advanceTicks(1800);
  assert.equal(count(w, E.WATER), n, 'water conserved');
  const left = surface(w, 100, 109, E.WATER), right = surface(w, 121, 131, E.WATER);
  assert.ok(right < before - 10, `the empty arm filled: surface ${before} -> ${right}`);
  assert.ok(Math.abs(left - right) <= 2, `arms level: left ${left}, right ${right}`);
});

test('a flat pool stays put (no churn from the pressure pass)', () => {
  const w = world();
  box(w, 99, 230, 99, FLOOR - 1, E.STONE); box(w, 201, 230, 201, FLOOR - 1, E.STONE);
  box(w, 100, 240, 200, FLOOR - 1, E.WATER);
  w.advanceTicks(60);
  const snap = Uint8Array.from(w.inspect().cells);
  w.advanceTicks(240);
  assert.deepEqual(w.inspect().cells, snap);
});

test('conducted heat: wood leaning on a lava cup\'s hot glass catches fire', () => {
  const w = world();
  box(w, 200, FLOOR - 6, 220, FLOOR - 1, E.GLASS);
  box(w, 201, FLOOR - 6, 219, FLOOR - 2, E.LAVA);
  box(w, 221, FLOOR - 8, 224, FLOOR - 1, E.WOOD);
  w.advanceTicks(900);
  assert.ok(count(w, E.WOOD) < 32, `wood burned: ${count(w, E.WOOD)} of 32 left`);
});

test('water in a glass cup over lava boils away as steam', () => {
  const w = world();
  box(w, 200, FLOOR - 3, 240, FLOOR - 1, E.LAVA);
  box(w, 205, FLOOR - 12, 235, FLOOR - 4, E.GLASS);
  box(w, 206, FLOOR - 12, 234, FLOOR - 5, E.AIR);
  box(w, 206, FLOOR - 7, 234, FLOOR - 5, E.WATER);
  const n = count(w, E.WATER);
  w.advanceTicks(1800);
  assert.ok(count(w, E.WATER) < n * 0.7, `water boiled: ${count(w, E.WATER)} of ${n}`);
});

test('blasts leave debris: the rim of a stone wall breaks into flying sand', () => {
  const w = world();
  box(w, 220, 150, 260, 190, E.STONE);
  w.inspect().detonate(240, 170, 6);
  assert.ok(count(w, E.SAND) > 6, `debris: ${count(w, E.SAND)} sand`);
  const s = w.inspect(); let flying = 0;
  for (let i = 0; i < s.cells.length; i++) if (s.cells[i] === E.SAND && Math.hypot(s.VX[i], s.VY[i]) > 1) flying++;
  assert.ok(flying > 4, `${flying} grains thrown`);
});

test('a blast in a woodpile throws embers', () => {
  const w = world();
  box(w, 220, 150, 260, 190, E.WOOD);
  w.inspect().detonate(240, 170, 6);
  assert.ok(count(w, E.EMBER) > 4, `embers: ${count(w, E.EMBER)}`);
});
