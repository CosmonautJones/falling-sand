import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/engine/world.js';
import { encodeCheckpoint, decodeCheckpoint } from '../public/v2/engine/checkpoint.js';

function lab(gravity = { x: 0, y: 1 }) {
  const world = E.createWorld({ scene: 'empty', seed: 97, weather: false, ambientEmbers: false });
  world.setGravity(gravity);
  return world;
}
function grains(world, material) {
  const s = world.inspect(), result = [];
  for (let i = 0; i < E.N; i++) if (s.cells[i] === material) result.push({ x: i % E.W, y: i / E.W | 0, vx: s.VX[i], vy: s.VY[i] });
  return result;
}
const mean = (points, axis) => points.reduce((sum, p) => sum + p[axis], 0) / points.length;

test('vector gravity has direction, magnitude, and persistent zero-g momentum', () => {
  const falls = [];
  for (const g of [0, 0.1, 1, 4]) {
    const world = lab({ x: 0, y: g }); world.inspect().setc(120, 60, E.TUNGSTEN, 0);
    world.advanceTicks(12); falls.push(grains(world, E.TUNGSTEN)[0].y);
  }
  assert.equal(falls[0], 60);
  assert.ok(falls[0] < falls[1] && falls[1] < falls[2] && falls[2] < falls[3], String(falls));
  const world = lab({ x: 0, y: 0 }), s = world.inspect();
  s.setc(120, 60, E.SAND, 0); s.VX[60 * E.W + 120] = 1.25;
  world.advanceTicks(20);
  assert.deepEqual(grains(world, E.SAND), [{ x: 145, y: 60, vx: 1.25, vy: 0 }]);
  world.setGravity({ x: -1, y: 0 }); world.advanceTicks(25);
  assert.ok(grains(world, E.SAND)[0].vx < 0, 'gravity reverses momentum over time');
});

test('fast particles stop at one-cell walls and preserve all grains', () => {
  const world = lab({ x: 1, y: 0 }), s = world.inspect();
  for (let y = 0; y < E.H; y++) s.setc(200, y, E.STEEL, 0);
  for (let y = 90; y < 100; y++) { s.setc(190, y, E.TUNGSTEN, 0); s.VX[y * E.W + 190] = 1000000; }
  world.advanceTicks(100);
  const points = grains(world, E.TUNGSTEN);
  assert.equal(points.length, 10);
  assert.ok(points.every(p => p.x < 200 && Number.isFinite(p.vx) && Number.isFinite(p.vy)));
  assert.equal(grains(world, E.STEEL).length, E.H);
});

test('dense sand falls equally in every gravity direction without false self-collisions', () => {
  const distances = [];
  const d = Math.SQRT1_2;
  for (const gravity of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: d, y: d }, { x: -d, y: d }, { x: d, y: -d }, { x: -d, y: -d }]) {
    const world = lab(gravity), s = world.inspect();
    for (let y = 120; y < 132; y++) for (let x = 220; x < 232; x++) s.setc(x, y, E.SAND, 0);
    world.advanceTicks(30);
    const points = grains(world, E.SAND);
    assert.equal(points.length, 144, 'rotation conserves every grain');
    const dx = mean(points, 'x') - 225.5, dy = mean(points, 'y') - 125.5;
    distances.push(dx * gravity.x + dy * gravity.y);
    assert.ok(Math.abs(dx * gravity.y - dy * gravity.x) < 0.1, 'an unobstructed cloud has no sideways impulse');
  }
  assert.ok(Math.min(...distances) > 60, `dense grains accelerate in open space: ${distances}`);
  assert.ok(Math.max(...distances) - Math.min(...distances) < 1, `rotating gravity preserves free-fall speed: ${distances}`);
});

test('dense weightless clouds keep their momentum in every direction', () => {
  for (const velocity of [{ x: 1.25, y: 0 }, { x: -1.25, y: 0 }, { x: 0, y: 1.25 }, { x: 0, y: -1.25 }]) {
    const world = lab({ x: 0, y: 0 }), s = world.inspect();
    for (let y = 120; y < 132; y++) for (let x = 220; x < 232; x++) {
      s.setc(x, y, E.SAND, 0); s.VX[y * E.W + x] = velocity.x; s.VY[y * E.W + x] = velocity.y;
    }
    world.advanceTicks(24);
    const points = grains(world, E.SAND);
    assert.equal(points.length, 144);
    assert.ok(Math.abs(mean(points, 'x') - 225.5 - velocity.x * 24) < 0.1);
    assert.ok(Math.abs(mean(points, 'y') - 125.5 - velocity.y * 24) < 0.1);
    assert.ok(points.every(p => p.vx === velocity.x && p.vy === velocity.y), 'neighbouring grains do not create drag in empty space');
  }
});

test('a thrown sand cloud follows a lone grain through a gravity turnaround', () => {
  const cloud = lab(), lone = lab(), s = cloud.inspect(), single = lone.inspect();
  for (let y = 120; y < 132; y++) for (let x = 220; x < 232; x++) {
    s.setc(x, y, E.SAND, 0); s.VY[y * E.W + x] = -3;
  }
  single.setc(220, 120, E.SAND, 0); single.VY[120 * E.W + 220] = -3;
  cloud.advanceTicks(30); lone.advanceTicks(30);
  const points = grains(cloud, E.SAND), grain = grains(lone, E.SAND)[0];
  assert.equal(points.length, 144);
  assert.ok(Math.abs(mean(points, 'y') - 125.5 - (grain.y - 120)) < 1);
  assert.ok(points.every(p => Math.abs(p.vy - grain.vy) < 0.001));
});

test('separate zero-g clouds carry opposite momentum independently', () => {
  const world = lab({ x: 0, y: 0 }), s = world.inspect();
  for (const [start, material, vx] of [[80, E.SAND, 1.25], [380, E.SALT, -1.25]]) {
    for (let y = 120; y < 132; y++) for (let x = start; x < start + 12; x++) {
      s.setc(x, y, material, 0); s.VX[y * E.W + x] = vx;
    }
  }
  world.advanceTicks(24);
  for (const [material, x, vx] of [[E.SAND, 115.5, 1.25], [E.SALT, 355.5, -1.25]]) {
    const points = grains(world, material);
    assert.equal(points.length, 144); assert.equal(mean(points, 'x'), x);
    assert.ok(points.every(p => p.vx === vx && p.vy === 0));
  }
});

test('a held brush preserves existing grain momentum and keeps pouring', () => {
  const world = lab(), s = world.inspect(), i = 30 * E.W + 100;
  s.setc(100, 30, E.WATER, 0); s.VY[i] = 0.5; s.PY[i] = 0.1; s.heat[i] = 60;
  world.applyOperations([{ t: 'p', x: 100, y: 30, r: 2, m: E.WATER }]);
  assert.equal(s.VY[i], 0.5); assert.ok(Math.abs(s.PY[i] - 0.1) < 1e-6); assert.equal(s.heat[i], 60);
  for (let t = 0; t < 60; t++) {
    world.applyOperations([{ t: 'p', x: 100, y: 30, r: 2, m: E.WATER }]);
    world.advanceTicks(1);
  }
  assert.ok(grains(world, E.WATER).length > 70, 'the stream leaves the brush instead of having its velocity reset');
});

test('detached structures translate together, conserve shape, and respond to reversed gravity', () => {
  const world = lab(), s = world.inspect();
  for (let y = 50; y < 54; y++) for (let x = 100; x < 108; x++) s.setc(x, y, E.STEEL, 0);
  world.advanceTicks(12);
  let points = grains(world, E.STEEL);
  assert.equal(points.length, 32);
  assert.equal(Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)), 7);
  assert.equal(Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)), 3);
  const firstY = mean(points, 'y'); assert.ok(firstY > 51.5);
  world.setGravity({ x: 0, y: -2 }); world.advanceTicks(20);
  points = grains(world, E.STEEL);
  assert.ok(mean(points, 'y') < firstY, 'reversed gravity lifts the free structure');
  assert.equal(points.length, 32);
});

test('boundary-connected foundations remain anchored under rotated gravity', () => {
  const world = lab({ x: 3, y: -1 }), s = world.inspect();
  for (let y = E.H - 12; y < E.H; y++) s.setc(100, y, E.BRICK, 0);
  const before = grains(world, E.BRICK);
  world.advanceTicks(40);
  assert.deepEqual(grains(world, E.BRICK), before);
});

test('gas buoyancy reverses with gravity and inert helium is conserved', () => {
  for (const direction of [-1, 1]) {
    const world = lab({ x: direction, y: 0 }); world.inspect().setc(240, 140, E.HELIUM, 0);
    world.advanceTicks(30);
    const points = grains(world, E.HELIUM);
    assert.equal(points.length, 1);
    assert.ok((points[0].x - 240) * direction < -5, 'gas rises opposite gravity');
  }
});

test('inverted oil and water layers sort by density without losing liquid', () => {
  const world = lab(), s = world.inspect();
  for (let y = 0; y < E.H; y++) { s.setc(190, y, E.STEEL, 0); s.setc(211, y, E.STEEL, 0); }
  for (let x = 190; x <= 211; x++) s.setc(x, 150, E.STEEL, 0);
  for (let y = 120; y < 150; y++) for (let x = 191; x < 211; x++) s.setc(x, y, y < 140 ? E.WATER : E.OIL, 0);
  world.advanceTicks(120);
  const water = grains(world, E.WATER), oil = grains(world, E.OIL);
  assert.equal(water.length, 400); assert.equal(oil.length, 200);
  assert.ok(mean(oil, 'y') < mean(water, 'y') - 10, 'lighter oil rises above water');
});

test('ferrofluid follows a magnet in zero gravity without creating material', () => {
  const world = lab({ x: 0, y: 0 }), s = world.inspect();
  s.setc(220, 100, E.MAGNET, 0); s.setc(200, 100, E.FERROFLUID, 0);
  world.advanceTicks(35);
  const points = grains(world, E.FERROFLUID);
  assert.equal(points.length, 1);
  assert.ok(points[0].x > 205, 'magnetic attraction works independently of gravity');
  assert.equal(grains(world, E.MAGNET).length, 1);
});

test('liquid nitrogen chills water and conserves nitrogen through boiling', () => {
  const world = lab({ x: 0, y: 0 }), s = world.inspect();
  s.setc(200, 100, E.WATER, 0);
  for (let y = 99; y <= 101; y++) for (let x = 199; x <= 201; x++) if (x !== 200 || y !== 100) s.setc(x, y, E.LIQUID_NITROGEN, 0);
  world.advanceTicks(8);
  assert.equal(grains(world, E.ICE).length, 1, 'cryogenic contact freezes water');
  s.heat[99 * E.W + 199] = 200;
  world.advanceTicks(2);
  assert.equal(grains(world, E.LIQUID_NITROGEN).length + grains(world, E.NITROGEN).length, 8);
  assert.ok(grains(world, E.NITROGEN).length > 0, 'warm nitrogen boils into its gas');
});

test('all material tables cover the expanded IDs and new paint operations validate', () => {
  assert.equal(E.COUNT, 73);
  for (const a of [E.NAMES, E.COLORS, E.KIND, E.PAGES]) assert.equal(a.length, E.COUNT);
  assert.equal(E.LUT.length, E.COUNT * 4);
  const world = lab();
  for (let m = 64; m < E.COUNT; m++) world.applyOperations([{ t: 'p', x: m * 3, y: 60, r: 0, m }]);
  for (let m = 64; m < E.COUNT; m++) assert.equal(grains(world, m).length, 1);
});

test('copper conducts into a neighbour while aerogel insulates the interface', () => {
  const temperature = material => {
    const world = lab({ x: 0, y: 0 }), s = world.inspect();
    s.setc(200, 100, E.COPPER, 0); s.setc(201, 100, material, 0);
    s.heat[100 * E.W + 200] = 200;
    world.advanceTicks(1);
    return s.heat[100 * E.W + 201];
  };
  assert.ok(temperature(E.COPPER) > 40, 'copper transmits the hot neighbour');
  assert.equal(temperature(E.AEROGEL), 18, 'aerogel blocks conductive exchange');
});

test('gravity and fractional positions round-trip with deterministic continuation; old saves stay legacy', () => {
  const first = lab({ x: 0.3, y: -0.2 });
  first.inspect().setc(200, 130, E.TUNGSTEN, 0); first.advanceTicks(7);
  const checkpoint = { format: 'alembic-world', version: 1, width: E.W, height: E.H, tick: 7, state: first.captureState() };
  const decoded = decodeCheckpoint(JSON.parse(JSON.stringify(encodeCheckpoint(checkpoint))));
  const second = lab(); second.restore(decoded.state);
  first.advanceTicks(15); second.advanceTicks(15);
  assert.deepEqual(second.captureState(), first.captureState());
  const old = E.createWorld({ scene: 'empty' }).captureState();
  assert.equal(Object.hasOwn(old, 'gravity'), false);
  second.restore(old);
  assert.equal(Object.hasOwn(second.captureState(), 'gravity'), false);
  assert.deepEqual(second.getGravity(), { x: 0, y: 1 });
});

test('invalid gravity is atomic and extreme vectors clamp to four Earth gravities', () => {
  const world = lab({ x: 1, y: 1 });
  assert.throws(() => world.setGravity({ x: NaN, y: 0 }), /gravity/);
  assert.deepEqual(world.getGravity(), { x: 1, y: 1 });
  world.setGravity({ x: 3, y: 4 });
  assert.ok(Math.abs(Math.hypot(...Object.values(world.getGravity())) - 4) < 1e-10);
  world.setGravity({ x: Number.MAX_VALUE, y: Number.MAX_VALUE });
  assert.ok(Math.abs(Math.hypot(...Object.values(world.getGravity())) - 4) < 1e-10, 'normalization cannot overflow');
});
