import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';
import { stepWalker, createWalkerState, dropWalkerIn } from '../public/v2/engine/walker.js';

const FLOOR = E.H - 4;
function floor(w) {
  w.applyOperation({ t: 'box', x0: 0, y0: FLOOR, x1: E.W - 1, y1: E.H - 1, m: E.STONE });
}
function count(w, m) {
  return w.inspect().cells.reduce((n, c) => n + (c === m), 0);
}

test('walker falls until the floor, then stands', () => {
  const w = E.createWorld({ seed: 9, scene: 'empty' });
  floor(w);
  w.dropWalkerAt(120, FLOOR - 3);
  w.setWalkerInput({ active: true });
  w.advanceTicks(8);
  const snap = w.finishFrame(true).walker;
  assert.ok(snap && snap.y >= FLOOR - 4, `walker landed near floor (${snap?.y})`);
  assert.equal(snap.phase, 'ground');
});

test('walker falls through steam and stands on sand', () => {
  const walker = createWalkerState();
  dropWalkerIn(walker, 40, 12);
  const cells = new Uint8Array(E.N);
  cells.fill(E.AIR);
  for (let y = 13; y < 22; y++) cells[y * E.W + 40] = E.STEAM;
  cells[22 * E.W + 40] = E.SAND;
  const get = (x, y) => (x < 0 || y < 0 || x >= E.W || y >= E.H ? E.STONE : cells[y * E.W + x]);
  const ctx = {
    get,
    bear: m => m !== E.AIR && m !== E.FIRE && m !== E.PLASMA && E.KIND[m] !== 3,
    open: m => m === E.AIR || E.KIND[m] === 3,
  };
  for (let i = 0; i < 12; i++) stepWalker(walker, { active: true }, ctx);
  assert.equal(walker.phase, 'ground');
  assert.equal(Math.round(walker.y), 21);
});

test('a hop clears one cell and does not keep rising', () => {
  const walker = createWalkerState();
  dropWalkerIn(walker, 30, 40);
  walker.phase = 'ground';
  const cells = new Uint8Array(E.N);
  cells.fill(E.AIR);
  for (let x = 0; x < E.W; x++) cells[41 * E.W + x] = E.STONE;
  cells[40 * E.W + 31] = E.STONE;
  const get = (x, y) => (x < 0 || y < 0 || x >= E.W || y >= E.H ? E.STONE : cells[y * E.W + x]);
  const ctx = { get, bear: m => m === E.STONE, open: m => m === E.AIR };
  stepWalker(walker, { active: true, jump: true, facing: 1 }, ctx);
  assert.equal(Math.round(walker.x), 31);
  assert.equal(Math.round(walker.y), 39);
  stepWalker(walker, { active: true }, ctx);
  assert.equal(Math.round(walker.y), 39);
});

test('walker cannot step diagonally through a wall', () => {
  const walker = createWalkerState();
  dropWalkerIn(walker, 50, FLOOR - 1);
  walker.phase = 'ground';
  const cells = new Uint8Array(E.N);
  cells.fill(E.AIR);
  for (let x = 0; x < E.W; x++) cells[(FLOOR + 1) * E.W + x] = E.STONE;
  cells[50 * E.W + 51] = E.STONE;
  const get = (x, y) => (x < 0 || y < 0 || x >= E.W || y >= E.H ? E.STONE : cells[y * E.W + x]);
  const MOV = new Uint8Array(64);
  MOV[E.AIR] = 1;
  const x0 = walker.x;
  stepWalker(walker, { active: true, right: true, up: true }, { get, MOV });
  assert.equal(walker.x, x0, 'diagonal move rejected');
});

test('poke shoves a beetle one cell', () => {
  const w = E.createWorld({ seed: 3, scene: 'empty' });
  floor(w);
  const sim = w.inspect();
  sim.setc(200, FLOOR - 1, E.BEETLE, 0);
  w.applyOperation({ t: 'poke', x: 200, y: FLOOR - 1, dx: 1, dy: 0 });
  assert.ok(count(w, E.BEETLE) === 1);
  assert.equal(sim.get(201, FLOOR - 1), E.BEETLE);
});

test('beetle grazes adjacent fungus', () => {
  const w = E.createWorld({ seed: 11, scene: 'empty' });
  floor(w);
  const sim = w.inspect();
  sim.setc(180, FLOOR - 1, E.BEETLE, 0);
  sim.setc(181, FLOOR - 1, E.FUNGUS, 0);
  for (let i = 0; i < 800; i++) w.advanceTicks(1);
  assert.ok(count(w, E.FUNGUS) < 1, 'fungus was grazed');
});

test('newt swims in water and opening vessel has none', () => {
  const open = E.createWorld({ seed: 0xa341316c, scene: 'vessel' });
  assert.equal(count(open, E.NEWT), 0);
  assert.equal(count(open, E.BEETLE), 0);
  const w = E.createWorld({ seed: 4, scene: 'empty' });
  floor(w);
  w.applyOperation({ t: 'box', x0: 100, y0: FLOOR - 8, x1: 140, y1: FLOOR - 1, m: E.WATER });
  w.inspect().setc(120, FLOOR - 2, E.NEWT, 0);
  w.advanceTicks(30);
  assert.ok(count(w, E.NEWT) >= 1, 'newt survives in water');
});

test('a beetle in open air falls instead of hovering', () => {
  const w = E.createWorld({ seed: 2, scene: 'empty' });
  floor(w);
  w.inspect().setc(150, 40, E.BEETLE, 0);
  w.advanceTicks(40);
  let y = -1;
  w.inspect().cells.forEach((c, i) => { if (c === E.BEETLE) y = (i / E.W) | 0; });
  assert.ok(y > 80, `beetle fell (y ${y})`);
  assert.equal(E.KIND[E.NEWT], E.KIND[E.MINNOW]);
});

test('beetle and newt are discoverable materials with codex pages', () => {
  for (const name of ['BEETLE', 'NEWT']) {
    const id = E[name];
    assert.ok(id >= 53 && id < E.COUNT, name);
    assert.ok(E.TRANSMUTED.includes(id));
    assert.ok(E.PAGES[id]?.w && E.HINTS[id]);
  }
});
