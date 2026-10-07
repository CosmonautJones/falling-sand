import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { E, _sim, W, H, reset, createEngine, run, positions, count, meanY, box, spread } from './helpers.js';

const { SAND, WATER, OIL, STONE, LAVA, OBSIDIAN, SEED, PLANT, TNT, AIR } = E;
const FLOOR_Y = H - 4; // first floor row

beforeEach(() => {
  reset();
  box(0, FLOOR_Y, W - 1, H - 1, STONE);
});

test('sand falls to the floor and forms a pile wider than its drop', () => {
  box(230, 40, 249, 54, SAND); // 20 x 15
  const n = count(SAND);
  run(500);
  assert.equal(count(SAND), n);
  const s = spread(SAND);
  assert.equal(s.maxY, FLOOR_Y - 1, 'pile rests on the floor');
  assert.ok(s.w > 1);
  assert.ok(s.w > 20, `pile width ${s.w} should exceed drop width 20`);
  assert.ok(s.maxY - s.minY + 1 < 15, 'pile slumps lower than the dropped block');
});

test('water spreads flat on the floor', () => {
  box(235, 100, 244, 109, WATER); // 10 x 10
  const n = count(WATER);
  run(500);
  assert.equal(count(WATER), n);
  const s = spread(WATER);
  assert.equal(s.maxY, FLOOR_Y - 1);
  assert.ok(s.w > 30, `water width ${s.w} should spread well past 10`);
  assert.ok(s.maxY - s.minY <= 3, `water depth range ${s.maxY - s.minY + 1} should be flat`);
});

test('sand sinks below water and oil floats above it', () => {
  const x0 = 200, x1 = 239, wall = FLOOR_Y - 1;
  box(x0 - 1, wall - 30, x0 - 1, wall, STONE);
  box(x1 + 1, wall - 30, x1 + 1, wall, STONE);
  box(x0, wall - 3, x1, wall, OIL); // bottom: oil
  box(x0, wall - 9, x1, wall - 4, WATER);
  box(x0, wall - 13, x1, wall - 10, SAND); // top: sand
  run(900);
  const my = { sand: meanY(SAND), water: meanY(WATER), oil: meanY(OIL) };
  assert.ok(my.sand > my.water, `sand ${my.sand} below water ${my.water}`);
  assert.ok(my.water > my.oil, `water ${my.water} below oil ${my.oil}`);
});

test('sand and water counts are conserved over 300 steps', () => {
  const x0 = 150, x1 = 250, wall = FLOOR_Y - 1;
  box(x0 - 1, wall - 60, x0 - 1, wall, STONE);
  box(x1 + 1, wall - 60, x1 + 1, wall, STONE);
  box(x0 + 10, wall - 45, x0 + 29, wall - 35, SAND);
  box(x0 + 40, wall - 45, x0 + 79, wall - 30, WATER);
  const s = count(SAND), w = count(WATER);
  run(300);
  assert.equal(count(SAND), s);
  assert.equal(count(WATER), w);
});

test('shade travels with the grain when it swaps', () => {
  _sim.setc(100, 50, SAND, 77);
  run(3);
  const p = positions(SAND);
  assert.equal(p.length, 1);
  const [x, y] = p[0];
  assert.ok(y > 50, 'grain fell');
  assert.equal(_sim.shades[y * W + x], 77);
  assert.equal(_sim.shades[50 * W + 100], 0, 'old cell no longer carries the shade');
});

test('lava meeting water quenches to obsidian', () => {
  box(200, FLOOR_Y - 4, 204, FLOOR_Y - 1, LAVA);
  box(205, FLOOR_Y - 4, 209, FLOOR_Y - 1, WATER);
  const w0 = count(WATER);
  assert.equal(count(OBSIDIAN), 0);
  run(60);
  assert.ok(count(WATER) < w0, 'water was consumed');
  assert.ok(count(OBSIDIAN) > 0, 'obsidian formed');
});

test('seed next to water becomes plant', () => {
  const x0 = 300, y = FLOOR_Y - 1;
  box(x0 - 1, y - 4, x0 - 1, y, STONE);
  box(x0 + 4, y - 4, x0 + 4, y, STONE);
  box(x0, y, x0 + 1, y, WATER);
  _sim.setc(x0 + 2, y, SEED, 0);
  run(5);
  assert.notEqual(_sim.get(x0 + 2, y), SEED, 'seed converted');
  assert.ok(count(PLANT) >= 1, 'plant grew');
});

test('tnt blast clears cells inside r and throws nearby sand', () => {
  const cx = 240, cy = FLOOR_Y - 20, r = 4;
  box(cx - 8, cy - 8, cx + 8, cy + 8, STONE);
  _sim.setc(cx + 3, cy, SAND, 0);
  _sim.detonate(cx, cy, r);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const m = _sim.get(cx + dx, cy + dy);
    assert.notEqual(m, STONE, `stone left at ${dx},${dy}`);
  }
  assert.equal(_sim.get(cx + 6, cy), STONE, 'stone outside r survives');
  const i = cy * W + cx + 3;
  assert.equal(_sim.get(cx + 3, cy), SAND);
  assert.ok(Math.abs(_sim.VX[i]) + Math.abs(_sim.VY[i]) > 1, 'sand got a velocity impulse');
});

test('createEngine().tick accepts a paint op without vx/vy', () => {
  const eng = createEngine();
  _sim.clear();
  _sim.seed(1);
  const color = new Uint8Array(W * H * 4), emis = new Uint8Array(W * H * 4), fx = new Uint8Array(W * H * 4);
  const r = eng.tick({ ops: [{ t: 'p', x: 100, y: 100, r: 2, m: SAND }], dt: 16.7, speed: 1 }, color, emis, fx);
  assert.equal(count(SAND), 13);
  assert.ok(r && typeof r.ms === 'number');
  assert.ok(Array.isArray(r.events));
  assert.ok(positions(SAND).every(([, y]) => y >= 100 - 2));
  assert.equal(color[(100 * W + 100) * 4 + 3] === SAND || color[(101 * W + 100) * 4 + 3] === SAND, true);
  assert.equal(count(AIR) + count(SAND), W * H);
});

test('runs are deterministic under the same seed', () => {
  const snap = () => {
    reset();
    box(0, FLOOR_Y, W - 1, H - 1, STONE);
    box(220, 60, 259, 90, SAND);
    box(180, 100, 200, 110, WATER);
    run(150);
    return Uint8Array.from(_sim.cells);
  };
  const a = snap(), b = snap();
  assert.deepEqual(a, b);
});
