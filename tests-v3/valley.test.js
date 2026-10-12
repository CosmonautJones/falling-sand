import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createValley, stringifyValley, parseValley } from '../public/v3/valley.js';
import { WATER, WOOD, AIR, W, PLANT } from '../public/v2/engine/world.js';

test('a seed reproduces the landscape and a different seed changes it', () => {
  const a = createValley({ seed: 12 });
  const b = createValley({ seed: 12 });
  const c = createValley({ seed: 13 });
  assert.deepEqual(a.checkpoint(), b.checkpoint());
  assert.notDeepEqual(a.inspect().surface, c.inspect().surface);
  assert.ok(a.inspect().world.cells.includes(WATER));
  assert.ok(a.inspect().world.cells.includes(WOOD));
});

test('opening the dam releases water into the dry valley and leaves retained moisture', () => {
  const valley = createValley({ seed: 12 });
  const initial = valley.stats().absorbed;
  valley.openDam();
  valley.advanceTicks(480);
  assert.ok(valley.stats().absorbed > initial + 20);
  assert.ok(
    valley
      .inspect()
      .soil.water.slice(24, 45)
      .some((n) => n > 0),
  );
  assert.ok(valley.stats().plantGrains > 0);
});

test('checkpoint JSON restores exact soil, plant, random and grain continuation', () => {
  const a = createValley({ seed: 512 });
  a.openDam();
  a.advanceTicks(125);
  const b = createValley({ seed: 1 });
  b.restore(parseValley(stringifyValley(a.checkpoint())));
  assert.deepEqual(a.checkpoint(), b.checkpoint());
  a.advanceTicks(180);
  b.advanceTicks(180);
  assert.deepEqual(a.checkpoint(), b.checkpoint());
});

test('malformed ecology saves are rejected before mutating the valley', () => {
  const valley = createValley({ seed: 3 });
  const before = valley.checkpoint();
  const bad = structuredClone(before);
  bad.ecology.water[0] = -1;
  assert.throws(() => valley.restore(bad), /Invalid valley/);
  assert.deepEqual(valley.checkpoint(), before);
  assert.throws(() => parseValley(' '.repeat(17 * 1024 * 1024 + 1)), /limit/);
  const sparse = structuredClone(before);
  delete sparse.surface[4];
  assert.throws(() => valley.restore(sparse), /Invalid valley/);
  const unknown = { ...before, surprise: 'discard me' };
  assert.throws(() => valley.restore(unknown), /Invalid valley/);
});

test('tools edit the actual grain world and seed additions are explicitly counted', () => {
  const valley = createValley({ seed: 3 });
  const sim = valley.inspect().world;
  valley.applyTool({ tool: 'water', x: 230, y: 80, r: 2 });
  assert.equal(sim.cells[80 * W + 230], WATER);
  valley.applyTool({ tool: 'dig', x: 230, y: 80, r: 2 });
  assert.equal(sim.cells[80 * W + 230], AIR);
  const before = valley.stats().nutrientUnits;
  valley.applyTool({ tool: 'seed', x: 230, y: 180, r: 2 });
  assert.equal(valley.stats().nutrientUnits, before + 1);
  assert.throws(() => valley.applyTool({ tool: 'nope', x: 1, y: 1, r: 2 }), /tool/);
});

test('the soil nutrient budget survives a flood, real fire and regrowth', () => {
  const valley = createValley({ seed: 0xc00c17 });
  const total = valley.stats().nutrientUnits;
  valley.openDam();
  valley.advanceTicks(900);
  const { soil } = valley.inspect();
  const q = soil.plants.findIndex(
    (p, q) => p && p.x > 165 && p.x < 280 && soil.water[q] > 6 && soil.seeds[q] > 0,
  );
  assert.ok(q >= 0);
  const plant = soil.plants[q];
  valley.applyTool({ tool: 'fire', x: plant.x, y: plant.y - 4, r: 5 });
  valley.advanceTicks(900);
  assert.equal(valley.stats().nutrientUnits, total);
  assert.ok(valley.inspect().soil.burn[q] > 0);
  assert.ok(valley.stats().flowers > 0);
});

test('watering and lighting a fire preserve ground; water also preserves living plants', () => {
  const valley = createValley({ seed: 9 });
  const { world, surface } = valley.inspect();
  const y = surface[240],
    floor = world.cells[y * W + 240];
  world.setc(240, y - 1, PLANT, 0);
  valley.applyTool({ tool: 'water', x: 240, y: y - 1, r: 5 });
  assert.equal(world.cells[y * W + 240], floor);
  assert.equal(world.cells[(y - 1) * W + 240], PLANT);
  valley.applyTool({ tool: 'fire', x: 240, y: y - 1, r: 5 });
  assert.equal(world.cells[y * W + 240], floor);
});

test('constructed stone shades plants without endlessly fueling a fire', () => {
  const valley = createValley({ seed: 9 });
  valley.applyTool({ tool: 'stone', x: 240, y: 140, r: 2 });
  const before = valley.inspect().world.cells[140 * W + 240];
  valley.applyTool({ tool: 'fire', x: 240, y: 137, r: 2 });
  valley.advanceTicks(600);
  assert.equal(valley.inspect().world.cells[140 * W + 240], before);
});

test('imports cannot schedule native v2 resets behind the soil layer', () => {
  const valley = createValley({ seed: 9 }),
    before = valley.checkpoint();
  const bad = structuredClone(before);
  bad.world.state.commands = [{ tick: 1, sequence: 0, op: { t: 'reset' } }];
  assert.throws(() => valley.restore(bad), /Invalid valley/);
  assert.deepEqual(valley.checkpoint(), before);
});

test('a quick quench cannot erase fire memory before the next soil step', () => {
  const valley = createValley({ seed: 0xc00c17 });
  valley.openDam();
  valley.advanceTicks(900);
  const { soil } = valley.inspect();
  const q = soil.plants.findIndex(
    (p, q) => p && p.x > 165 && p.x < 280 && soil.water[q] > 6 && soil.seeds[q] > 0,
  );
  const plant = soil.plants[q];
  valley.applyTool({ tool: 'fire', x: plant.x, y: plant.y - 4, r: 5 });
  valley.applyTool({ tool: 'water', x: plant.x, y: plant.y - 4, r: 5 });
  valley.advanceTicks(30);
  assert.ok(valley.inspect().soil.burn[q] > 0);
  const saved = valley.checkpoint(),
    restored = createValley({ seed: 1 });
  restored.restore(parseValley(stringifyValley(saved)));
  assert.equal(restored.inspect().soil.burn[q], valley.inspect().soil.burn[q]);
});

test('dam readiness is derived from the world and survives loading either state', () => {
  const a = createValley({ seed: 12 }),
    b = createValley({ seed: 3 });
  assert.equal(a.stats().damIntact, true);
  b.restore(a.checkpoint());
  assert.equal(b.stats().damIntact, true);
  a.openDam();
  b.restore(a.checkpoint());
  assert.equal(b.stats().damIntact, false);
});
