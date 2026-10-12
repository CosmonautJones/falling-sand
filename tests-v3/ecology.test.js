import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  W,
  AIR,
  WATER,
  STONE,
  WOOD,
  PLANT,
  FIRE,
  ASH,
} from '../public/v2/engine/world.js';
import { createEcology, PATCHES } from '../public/v3/ecology.js';

function bed() {
  const world = createWorld({
    scene: 'empty',
    seed: 5,
    vegetation: 'managed',
    ambientEmbers: false,
  }).inspect();
  const surface = new Uint16Array(W).fill(200);
  for (let x = 0; x < W; x++) world.setc(x, 200, STONE, 0);
  const ecology = createEcology({ world, surface, seed: 11 });
  const soil = ecology.inspect();
  soil.seeds.fill(0);
  soil.nutrients.fill(0);
  return { world, ecology, soil, q: 20, x: 164 };
}

test('roots debit real water grains and retain the water in soil', () => {
  const { world, ecology, soil, q, x } = bed();
  world.setc(x, 199, WATER, 0);
  ecology.step();
  assert.equal(world.cells[199 * W + x], AIR);
  assert.equal(soil.water[q], 1);
  assert.equal(ecology.stats().absorbed, 1);
});

test('a seed and growth spend finite resources; no water or nutrients means no growth', () => {
  const { ecology, soil, q } = bed();
  soil.seeds[q] = 1;
  soil.nutrients[q] = 8;
  ecology.step();
  assert.equal(ecology.stats().plantGrains, 0);
  soil.water[q] = 20;
  const before = ecology.stats().nutrientUnits;
  for (let i = 0; i < 6; i++) ecology.step();
  assert.ok(ecology.stats().plantGrains > 1);
  assert.equal(ecology.stats().nutrientUnits, before);
  assert.ok(soil.water[q] < 20);
  soil.nutrients[q] = 0;
  const grains = ecology.stats().plantGrains;
  ecology.step();
  assert.equal(ecology.stats().plantGrains, grains);
});

test('a stone roof blocks germination while exposed seeds grow', () => {
  const { world, ecology, soil, q, x } = bed();
  soil.seeds[q] = 1;
  soil.nutrients[q] = 8;
  soil.water[q] = 30;
  for (let dx = -4; dx <= 4; dx++) world.setc(x + dx, 150, STONE, 0);
  ecology.step();
  assert.equal(ecology.stats().plantGrains, 0);
  assert.equal(soil.light[q], 0);
  for (let dx = -4; dx <= 4; dx++) world.setc(x + dx, 150, AIR, 0);
  ecology.step();
  assert.equal(ecology.stats().plantGrains, 1);
});

test('submerged roots favor reeds, which spend water while growing through the pool', () => {
  const { world, ecology, soil, q, x } = bed();
  soil.seeds[q] = 1;
  soil.nutrients[q] = 20;
  for (let y = 190; y < 200; y++) for (let dx = -3; dx <= 3; dx++) world.setc(x + dx, y, WATER, 0);
  ecology.step();
  assert.equal(soil.plants[q].kind, 'reed');
  for (let i = 0; i < 6; i++) ecology.step();
  assert.ok(soil.plants[q].nodes.length > 5);
  assert.ok(ecology.stats().absorbed > 8);
});

test('burned plant investment becomes litter and regrowth selects a fireflower', () => {
  const { world, ecology, soil, q } = bed();
  soil.seeds[q] = 2;
  soil.nutrients[q] = 30;
  soil.water[q] = 50;
  ecology.step();
  const node = soil.plants[q].nodes[0];
  world.setc(node % W, Math.floor(node / W), FIRE, 0);
  const total = ecology.stats().nutrientUnits;
  ecology.step();
  assert.equal(soil.burn[q], 120);
  assert.equal(soil.litter[q], 1);
  assert.equal(ecology.stats().nutrientUnits, total);
  world.setc(node % W, Math.floor(node / W), AIR, 0);
  ecology.step();
  assert.equal(soil.plants[q].kind, 'fireflower');
});

test('cooled ash does not permanently block a paid seed from germinating', () => {
  const { world, ecology, soil, q, x } = bed();
  soil.seeds[q] = 1;
  soil.water[q] = 20;
  soil.burn[q] = 120;
  world.setc(x, 199, ASH, 0);
  ecology.step();
  assert.equal(soil.plants[q]?.kind, 'fireflower');
  assert.equal(soil.seeds[q], 0);
});

test('uprooted plants return nutrients and cannot keep growing in midair', () => {
  const { world, ecology, soil, q, x } = bed();
  soil.seeds[q] = 1;
  soil.nutrients[q] = 20;
  soil.water[q] = 50;
  ecology.step();
  world.setc(x, 200, AIR, 0);
  ecology.step();
  assert.equal(soil.plants[q], null);
  assert.equal(ecology.stats().plantGrains, 0);
  assert.equal(soil.litter[q], 1);
});

test('cutting a grown stem retires the plant rather than leaving a floating canopy', () => {
  const { world, ecology, soil, q } = bed();
  soil.seeds[q] = 1;
  soil.nutrients[q] = 30;
  soil.water[q] = 60;
  for (let i = 0; i < 5; i++) ecology.step();
  const plant = soil.plants[q],
    investment = plant.nodes.length;
  assert.ok(investment > 5);
  const cut = plant.nodes[2];
  world.setc(cut % W, Math.floor(cut / W), AIR, 0);
  ecology.step();
  assert.equal(soil.plants[q], null);
  assert.equal(soil.litter[q], investment);
});

test('drought eventually returns a plant to litter without conjuring seeds', () => {
  const { ecology, soil, q } = bed();
  soil.seeds[q] = 1;
  soil.nutrients[q] = 30;
  soil.water[q] = 4;
  ecology.step();
  soil.water.fill(0);
  for (let i = 0; i < 25; i++) ecology.step();
  assert.equal(ecology.stats().plantGrains, 0);
  assert.equal(soil.seeds[q], 0);
  assert.equal(soil.litter[q], 1);
});

test('soil transport and evaporation account for every absorbed water unit', () => {
  const { ecology, soil, q } = bed();
  soil.water[q] = 80;
  for (let i = 0; i < 24; i++) ecology.step();
  const stats = ecology.stats();
  assert.equal(soil.water.reduce((a, b) => a + b, 0) + stats.spentWater, 80);
  assert.ok(soil.water[q - 1] > 0);
  assert.equal(soil.water.length, PATCHES);
});

test('managed vegetation does not run v2 native propagation', () => {
  const world = createWorld({
    scene: 'empty',
    seed: 21,
    vegetation: 'managed',
    ambientEmbers: false,
  });
  const sim = world.inspect();
  for (let x = 95; x <= 105; x++) sim.setc(x, 199, WOOD, 0);
  sim.setc(100, 198, PLANT, 0);
  sim.setc(101, 198, WATER, 0);
  world.advanceTicks(180);
  assert.equal(
    sim.cells.reduce((n, m) => n + (m === PLANT), 0),
    1,
  );
});

test('v3 does not receive the native periodic ember rain', () => {
  const world = createWorld({
    scene: 'empty',
    seed: 21,
    vegetation: 'managed',
    ambientEmbers: false,
  });
  const state = world.captureState();
  state.tickIndex = 2699;
  world.restore(state);
  world.advanceTicks(1);
  assert.ok(world.inspect().cells.every((m) => m === AIR));
});
