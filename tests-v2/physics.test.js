import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { E, _sim, W, H, reset, run, positions, count, meanY, box, spread } from './helpers.js';

const { SAND, WATER, OIL, STONE, LAVA, ASH, MUD, SALT, MERCURY, AIR } = E;
const FLOOR_Y = H - 4;

beforeEach(() => {
  reset();
  box(0, FLOOR_Y, W - 1, H - 1, STONE);
});

function pileWidth(m) {
  reset();
  box(0, FLOOR_Y, W - 1, H - 1, STONE);
  box(230, 20, 249, 49, m); // 20 x 30 = 600 grains
  const n = count(m);
  run(400);
  assert.equal(count(m), n, `${m} conserved`);
  const xs = positions(m).map(([x]) => x).sort((a, b) => a - b);
  return xs[Math.floor(xs.length * 0.97)] - xs[Math.floor(xs.length * 0.03)] + 1; // robust to stray grains
}

test('powders pile by material: sand loosest, salt middle, mud steepest', () => {
  const sand = pileWidth(SAND), salt = pileWidth(SALT), ash = pileWidth(MUD);
  assert.ok(sand >= salt + 2, `sand ${sand} wider than salt ${salt}`);
  assert.ok(salt >= ash + 2, `salt ${salt} wider than ash ${ash}`);
});

function liquidWidth(m, steps) {
  reset();
  box(0, FLOOR_Y, W - 1, H - 1, STONE);
  box(235, FLOOR_Y - 10, 244, FLOOR_Y - 1, m);
  run(steps);
  return spread(m).w;
}

test('lava is viscous: water spreads at least 2x wider in 120 steps', () => {
  const water = liquidWidth(WATER, 120), lava = liquidWidth(LAVA, 120);
  assert.ok(water >= lava * 2, `water ${water} vs lava ${lava}`);
});

test('a 100-wide water lump levels within 150 steps', () => {
  const x0 = 190, x1 = 289, top = FLOOR_Y - 1;
  box(x0 - 1, top - 30, x0 - 1, top, STONE);
  box(x1 + 1, top - 30, x1 + 1, top, STONE);
  box(x0, top - 7, x0 + 49, top, WATER); // left half only, 8 high
  const n = count(WATER);
  run(150);
  assert.equal(count(WATER), n);
  const heights = [];
  for (let x = x0; x <= x1; x++) {
    let h = 0;
    for (let y = top; y > top - 30 && _sim.get(x, y) === WATER; y--) h++;
    heights.push(h);
  }
  const range = Math.max(...heights) - Math.min(...heights);
  assert.ok(range <= 2, `height range ${range} (min ${Math.min(...heights)} max ${Math.max(...heights)})`);
});

function dropSteps(medium) {
  reset();
  box(0, FLOOR_Y, W - 1, H - 1, STONE);
  const x = 200, top = FLOOR_Y - 60, bot = FLOOR_Y - 1;
  box(x - 1, top - 5, x - 1, bot, STONE);
  box(x + 1, top - 5, x + 1, bot, STONE);
  if (medium !== AIR) box(x, bot - 39, x, bot, medium);
  _sim.setc(x, bot - 40, SAND, 0);
  for (let s = 1; s <= 1500; s++) {
    _sim.step();
    if (_sim.get(x, bot) === SAND) return s;
  }
  return 1500;
}

test('sand sinks through a 40-cell water column >= 2x slower than free fall', () => {
  const air = dropSteps(AIR), water = dropSteps(WATER);
  assert.ok(water >= air * 2, `water ${water} vs air ${air}`);
});

test('mercury still sinks plainly through water', () => {
  const sink = (m) => {
    reset();
    box(0, FLOOR_Y, W - 1, H - 1, STONE);
    const x0 = 200, x1 = 229, bot = FLOOR_Y - 1;
    box(x0 - 1, bot - 40, x0 - 1, bot, STONE);
    box(x1 + 1, bot - 40, x1 + 1, bot, STONE);
    box(x0, bot - 9, x1, bot, WATER);
    box(x0 + 10, bot - 14, x0 + 14, bot - 10, m);
    for (let s = 1; s <= 600; s++) {
      run(1);
      if (meanY(m) >= bot - 4) return s;
    }
    return 600;
  };
  const merc = sink(MERCURY);
  assert.ok(merc < 600, `mercury sank (${merc})`);
});

test('oil and water separate and then sit still without flicker', () => {
  const x0 = 200, x1 = 239, bot = FLOOR_Y - 1;
  box(x0 - 1, bot - 30, x0 - 1, bot, STONE);
  box(x1 + 1, bot - 30, x1 + 1, bot, STONE);
  for (let y = bot - 11; y <= bot; y++) for (let x = x0; x <= x1; x++) _sim.setc(x, y, ((x + y) & 1) ? OIL : WATER, 0);
  run(600);
  assert.ok(meanY(OIL) < meanY(WATER) - 3, `oil ${meanY(OIL)} above water ${meanY(WATER)}`);
  let changes = 0, cellsN = 0;
  for (let s = 0; s < 20; s++) {
    const before = Uint8Array.from(_sim.cells);
    run(1);
    for (let y = bot - 11; y <= bot; y++) for (let x = x0; x <= x1; x++) {
      cellsN++;
      if (before[y * W + x] !== _sim.cells[y * W + x]) changes++;
    }
  }
  assert.ok(changes / cellsN < 0.01, `flicker ${(changes / cellsN * 100).toFixed(2)}% of cells per step`);
});

function buffers() { return [new Uint8Array(W * H * 4), new Uint8Array(W * H * 4), new Uint8Array(W * H * 4)]; }
function paintAndRun(extra, steps = 40) {
  reset();
  const eng = E.createEngine();
  _sim.clear(); _sim.seed(1);
  const [c, e, f] = buffers();
  eng.tick({ ops: [{ t: 'p', x: 100, y: 60, r: 3, m: SAND, ...extra }], dt: 16.7, speed: 1 }, c, e, f);
  for (let i = 0; i < steps; i++) _sim.step();
  const p = positions(SAND);
  return { n: p.length, mx: p.reduce((a, [x]) => a + x, 0) / p.length, cells: Uint8Array.from(_sim.cells) };
}

test('paint ops carry optional vx/vy into the painted grains', () => {
  const control = paintAndRun({}), again = paintAndRun({}), fling = paintAndRun({ vx: 4, vy: -1 });
  assert.deepEqual(control.cells, again.cells, 'no-field op deterministic');
  assert.equal(fling.n, control.n);
  assert.ok(fling.mx > control.mx + 3, `flung ${fling.mx} vs control ${control.mx}`);
  const l = (extra) => {
    reset(); const eng = E.createEngine(); _sim.clear(); _sim.seed(1);
    const [c, e, f] = buffers();
    eng.tick({ ops: [{ t: 'l', x0: 100, y0: 60, x1: 104, y1: 60, r: 2, m: SAND, ...extra }], dt: 16.7, speed: 1 }, c, e, f);
    for (let i = 0; i < 30; i++) _sim.step();
    const p = positions(SAND); return p.reduce((a, [x]) => a + x, 0) / p.length;
  };
  assert.ok(l({ vx: 4 }) > l({}) + 3, 'line op honours vx');
});

test('gas wisps still reach the ceiling and are conserved', () => {
  const { STEAM } = E;
  const x0 = 200, x1 = 215, bot = FLOOR_Y - 1, ceil = bot - 60;
  box(x0 - 1, ceil, x0 - 1, bot, STONE);
  box(x1 + 1, ceil, x1 + 1, bot, STONE);
  box(x0 - 1, ceil - 1, x1 + 1, ceil - 1, STONE);
  box(x0, bot - 3, x1, bot, STEAM);
  const n = count(STEAM);
  let top = Infinity;
  for (let s = 0; s < 150; s++) { run(1); top = Math.min(top, ...positions(STEAM).map(([, y]) => y)); }
  assert.equal(count(STEAM) + count(WATER) + count(E.CLOUD), n, 'no gas lost (may condense)');
  assert.ok(top <= ceil + 2, `gas reached the ceiling (top ${top})`);
});

test('blast throws loose powder just outside the radius', () => {
  const cx = 240, cy = FLOOR_Y - 20, r = 4;
  _sim.setc(cx + r + 2, cy, SAND, 0);
  _sim.detonate(cx, cy, r);
  const i = cy * W + cx + r + 2;
  assert.equal(_sim.get(cx + r + 2, cy), SAND);
  assert.ok(_sim.VX[i] > 1, `rim sand pushed outward (vx ${_sim.VX[i]})`);
});

function layerRun(top, bottom, steps) {
  const x0 = 200, x1 = 229, bot = FLOOR_Y - 1;
  box(x0 - 1, bot - 30, x0 - 1, bot + 1, E.GLASS); // glass: acid does not eat it
  box(x1 + 1, bot - 30, x1 + 1, bot + 1, E.GLASS);
  box(x0, bot + 1, x1, bot + 1, E.GLASS);
  box(x0, bot - 9, x1, bot - 5, top);
  box(x0, bot - 4, x1, bot, bottom);
  run(steps);
}

test('acid poured over water ends below it (small density gaps still layer)', () => {
  const { ACID } = E;
  reset(); box(0, FLOOR_Y, W - 1, H - 1, STONE);
  layerRun(ACID, WATER, 400); // acid on top of water
  assert.ok(meanY(ACID) > meanY(WATER), `acid ${meanY(ACID)} below water ${meanY(WATER)}`);
});

test('nitro under water rises above it', () => {
  const { NITRO } = E;
  layerRun(WATER, NITRO, 500);
  assert.ok(meanY(NITRO) < meanY(WATER), `nitro ${meanY(NITRO)} above water ${meanY(WATER)}`);
});

function tickOp(op, keep) {
  const saved = keep ? Uint8Array.from(_sim.cells) : null;
  const eng = E.createEngine();
  _sim.clear(); _sim.seed(1);
  if (saved) for (let i = 0; i < saved.length; i++) if (saved[i]) _sim.setc(i % W, (i / W) | 0, saved[i], 0);
  const [c, e, f] = buffers();
  eng.tick({ ops: [op], dt: 16.7, speed: 1 }, c, e, f);
}

test('fling only affects newly painted grains, not an existing resting pile', () => {
  for (const t of ['p', 'l']) {
    reset(); box(0, FLOOR_Y, W - 1, H - 1, STONE);
    const old = [];
    for (let x = 100; x <= 104; x++) { _sim.setc(x, FLOOR_Y - 1, SAND, 0); old.push(FLOOR_Y - 1); }
    const op = t === 'p' ? { t, x: 102, y: FLOOR_Y - 5, r: 4, m: SAND, vx: 5, vy: -2 }
      : { t, x0: 98, y0: FLOOR_Y - 8, x1: 106, y1: FLOOR_Y - 8, r: 3, m: SAND, vx: 5, vy: -2 };
    tickOp(op, true);
    let fresh = 0;
    for (let y = FLOOR_Y - 30; y < FLOOR_Y; y++) for (let x = 90; x <= 115; x++) {
      const i = y * W + x; if (_sim.cells[i] !== SAND) continue;
      if (y === FLOOR_Y - 1 && x >= 100 && x <= 104) {
        assert.equal(_sim.VX[i], 0, `old grain VX (${t})`); assert.equal(_sim.VY[i], 0, `old grain VY (${t})`);
      } else if (_sim.VX[i] > 1) fresh++;
    }
    assert.ok(fresh > 0, `new grains flung (${t})`);
  }
});

test('fling is finite, clamped, and ignores static materials', () => {
  const { MAXV } = _sim;
  for (const [vx, vy] of [[NaN, Infinity], [1e9, -1e9], [-Infinity, 3]]) {
    reset();
    tickOp({ t: 'p', x: 100, y: 60, r: 2, m: SAND, vx, vy });
    for (let i = 0; i < _sim.VX.length; i++) {
      assert.ok(Number.isFinite(_sim.VX[i]) && Math.abs(_sim.VX[i]) <= MAXV);
      assert.ok(Number.isFinite(_sim.VY[i]) && Math.abs(_sim.VY[i]) <= MAXV);
    }
  }
  reset();
  tickOp({ t: 'p', x: 100, y: 60, r: 2, m: STONE, vx: 5, vy: 5 });
  assert.ok(count(STONE) > 0);
  assert.ok(_sim.VX.every(v => v === 0) && _sim.VY.every(v => v === 0), 'stone gets no velocity');
  reset();
  tickOp({ t: 'p', x: 150, y: 60, r: 2, m: E.MITE, vx: 5, vy: 5 });
  assert.ok(count(E.MITE) > 0);
  assert.ok(_sim.VX.every(v => Math.abs(v) < 1) && _sim.VY.every(v => Math.abs(v) < 1), 'critter gets no fling velocity');
});
