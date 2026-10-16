import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as E from '../public/v2/alembic-engine-v2.js';
import { createRandom } from '../public/v2/engine/random.js';
import { createGrowthFixture, growthCounts, runGrowthTicks, GROWTH_FIXTURE_VERSION } from './growth-fixtures.js';

const hashState = state => createHash('sha256').update(JSON.stringify(state, (_, value) => ArrayBuffer.isView(value)
  ? { type: value.constructor.name, bytes: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') }
  : value)).digest('hex');
const run = (scene, ticks, seed = 73, options = {}) => {
  const world = createGrowthFixture(E, { scene, seed, ...options });
  const initial = growthCounts(E, world);
  runGrowthTicks(world, ticks);
  return { world, initial, final: growthCounts(E, world) };
};
const setEcologySeed = (world, seed) => {
  const state = world.captureState(); state.random.ecology = seed; world.restore(state);
};
const firstZeroSeed = bound => {
  for (let seed = 0; ; seed++) {
    if (createRandom(seed).int(bound) === 0) return seed;
  }
};
const firstNonZeroSeed = bound => {
  for (let seed = 0; ; seed++) {
    if (createRandom(seed).int(bound) !== 0) return seed;
  }
};
const firstZeroResetSeed = bound => {
  for (let seed = 0; ; seed++) {
    if (createRandom((seed ^ 0x9e3779b9) >>> 0).int(bound) === 0) return seed;
  }
};

test('dry exposed plants decline into ash without water or added heat', () => {
  const { initial, final } = run('dry', 600);
  assert.ok(initial.plant > 0 && initial.bloom > 0, 'dry fixture starts with living material');
  assert.ok(final.plant + final.bloom < initial.plant + initial.bloom, 'dry living material declines');
  assert.ok(final.ash > 0, 'dry decay leaves ash');
});

test('growth fixture v3 keeps the shore wet through its stone floor', () => {
  const world = createGrowthFixture(E, { scene: 'shore', seed: 73 });
  const sim = world.inspect();
  assert.equal(GROWTH_FIXTURE_VERSION, 3);
  assert.equal(sim.get(176, 257), E.WATER, 'shore water reaches the floor');
  assert.equal(sim.get(176, 230), E.MUD, 'shore mud remains exposed');
  assert.equal(sim.get(176, 231), E.STONE, 'shore mud remains on stone');
});

test('dry ash does not irrigate a neighboring plant', () => {
  const world = E.createWorld({ seed: 17, scene: 'empty', vegetation: 'native', weather: false, ambientEmbers: false });
  const sim = world.inspect();
  for (let x = 198; x <= 202; x++) sim.setc(x, 231, E.STONE, 0);
  sim.setc(200, 230, E.PLANT, 0); sim.setc(201, 230, E.ASH, 0);
  const initial = growthCounts(E, world);
  world.advanceTicks(300);
  const final = growthCounts(E, world);
  assert.equal(initial.water + initial.mud, 0, 'dry ash fixture has no wet input');
  assert.equal(final.water + final.mud, 0, 'dry ash does not create a wet input');
  assert.ok(final.plant <= initial.plant && final.bloom === 0 && final.seed === 0, 'dry ash does not cause plant propagation');
});

test('an isolated bloom still decays when it has no neighboring living material', () => {
  const world = E.createWorld({ seed: 19, scene: 'empty', vegetation: 'native', weather: false, ambientEmbers: false });
  const sim = world.inspect();
  for (let x = 198; x <= 202; x++) sim.setc(x, 231, E.STONE, 0);
  sim.setc(200, 230, E.BLOOM, 0);
  assert.equal(growthCounts(E, world).bloom, 1, 'isolated fixture starts with one bloom');
  world.advanceTicks(30);
  assert.equal(sim.get(200, 230), E.BLOOM, 'the isolated bloom survives while its chunk settles');
  // Reset only the random streams after the chunk is quiet; restore() would wake it and hide the native wake requirement.
  sim.seed(firstZeroResetSeed(E.ECOLOGY.dryDecay));
  world.advanceTicks(1);
  const final = growthCounts(E, world);
  assert.equal(final.bloom, 0, 'isolated bloom runs its decay reaction');
  assert.ok(final.ash > 0, 'isolated bloom leaves ash');
});

test('wet mud regenerates growth without an initial seed', () => {
  const world = createGrowthFixture(E, { scene: 'shore', seed: 991 });
  const start = growthCounts(E, world);
  assert.equal(start.seed + start.plant + start.bloom, 0, 'shore starts without living grains');
  setEcologySeed(world, firstZeroSeed(E.ECOLOGY.mudSeed));
  const firstSeen = { seed: null, plant: null, bloom: null };
  for (let tick = 0; tick < 120; tick++) {
    runGrowthTicks(world, 1);
    const sample = growthCounts(E, world);
    for (const stage of Object.keys(firstSeen)) if (firstSeen[stage] === null && sample[stage] > 0) firstSeen[stage] = tick + 1;
    if (firstSeen.seed !== null && firstSeen.plant !== null) break;
  }
  assert.ok(firstSeen.seed !== null, 'freshwater mud first spends itself on a seed');
  assert.ok(firstSeen.plant !== null, 'the new seed reaches the existing plant stage');
  assert.ok(firstSeen.seed < firstSeen.plant, `growth stages are observed in order (${JSON.stringify(firstSeen)})`);
});

test('settled shore mud still cycles on its natural ecology clock', () => {
  const world = createGrowthFixture(E, { scene: 'shore', seed: 991 });
  const initial = growthCounts(E, world);
  runGrowthTicks(world, 30);
  const sim = world.inspect();
  for (let x = 176; x <= 190; x += 2) {
    const neighbors = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) neighbors.push(sim.get(x + dx, 230 + dy));
    assert.equal(sim.get(x, 230), E.MUD, `shore mud remains supported at x=${x}`);
    assert.ok(neighbors.includes(E.WATER) && neighbors.includes(E.AIR), `shore mud remains eligible at x=${x}`);
  }
  runGrowthTicks(world, 570);
  const final = growthCounts(E, world);
  assert.equal(initial.seed + initial.plant + initial.bloom, 0, 'natural shore starts without living growth');
  assert.ok(final.seed + final.plant + final.bloom > 0, 'settled exposed mud eventually starts native growth');
  assert.ok(final.mud < initial.mud, 'natural regrowth spends at least one mud grain');
});

test('mud births consume the resource and stop at the local crowd limit', () => {
  const free = createGrowthFixture(E, { scene: 'crowded', seed: 2026 });
  const freeSim = free.inspect();
  assert.equal(growthCounts(E, free).mite, 3, 'crowd fixture starts with three neighboring mites');
  freeSim.setc(209, 229, E.AIR, 0); freeSim.setc(211, 229, E.AIR, 0);
  setEcologySeed(free, firstZeroSeed(E.ECOLOGY.mudHatch));
  free.advanceTicks(1);
  assert.equal(free.inspect().get(210, 230), E.MITE, 'food-backed mud hatches one mite');

  const capped = createGrowthFixture(E, { scene: 'crowded', seed: 2026 });
  const cappedStart = growthCounts(E, capped);
  assert.equal(cappedStart.mite, E.ECOLOGY.miteCrowd, 'capped fixture supplies the full local crowd');
  setEcologySeed(capped, firstNonZeroSeed(E.ECOLOGY.mudSeed));
  capped.advanceTicks(1);
  assert.equal(capped.inspect().get(210, 230), E.MUD, 'a crowded food patch keeps its mud resource');
});

test('dead carried mites spill gold and mud cargo before becoming ash or water', () => {
  const { world, initial } = run('cargo', 1);
  const final = growthCounts(E, world);
  assert.equal(initial.mite, 2, 'cargo fixture starts with two mites');
  assert.equal(initial.goldCarried, 1, 'gold cargo starts on one mite');
  assert.equal(initial.goldTotal, 1, 'gold cargo starts on one mite');
  assert.ok(final.gold > 0, 'gold cargo is preserved on mite death');
  assert.equal(final.goldTotal, initial.goldTotal, 'gold cargo is conserved across mite death');
  assert.ok(final.mud > 0, 'mud cargo is preserved on mite death');
  assert.ok(final.mite < initial.mite, 'the predator pairs kill their mites');
});

test('native death residue supports staged ash, mud, seed, and plant transitions', () => {
  const world = E.createWorld({ seed: 2026, scene: 'empty', vegetation: 'native', weather: false, ambientEmbers: false });
  const sim = world.inspect(), x = 200, y = 230;
  // Stage the ordinary reaction inputs between ticks so each causal transition is observable.
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx || dy) sim.setc(x + dx, y + dy, E.STONE, 0);
  }
  for (let dx = -1; dx <= 1; dx++) sim.setc(x + dx, y - 1, E.WATER, 0);
  sim.setc(x, y, E.MITE, 0);
  setEcologySeed(world, firstZeroSeed(E.LIFE.miteAge));
  world.advanceTicks(1);
  assert.ok(growthCounts(E, world).ash > 0, 'a dead mite leaves ash');

  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx || dy) sim.setc(x + dx, y + dy, E.STONE, 0);
  }
  sim.setc(x, y, E.ASH, 0);
  sim.setc(x, y - 1, E.WATER, 0);
  sim.setc(x - 1, y, E.AIR, 0); sim.setc(x + 1, y, E.AIR, 0);
  world.advanceTicks(1);
  assert.equal(sim.get(x, y), E.MUD, 'water turns ash into mud');

  sim.setc(x, y - 1, E.WATER, 0);
  sim.setc(x - 1, y, E.AIR, 0); sim.setc(x + 1, y, E.AIR, 0);
  setEcologySeed(world, firstZeroSeed(E.ECOLOGY.mudSeed));
  world.advanceTicks(1);
  assert.equal(sim.get(x, y), E.SEED, 'freshwater mud spends itself on a seed');
  sim.setc(x, y - 1, E.WATER, 0);
  world.advanceTicks(1);
  assert.equal(sim.get(x, y), E.PLANT, 'the new seed uses existing germination');
});

test('managed vegetation remains outside native V2 growth propagation', () => {
  const { initial, final } = run('dry', 600, 73, { vegetation: 'managed' });
  for (const material of ['plant', 'bloom', 'seed', 'mite']) {
    assert.equal(final[material], initial[material], `managed ${material} count is unchanged`);
  }
});

test('growth cycle checkpoint continuation is exact', () => {
  const a = createGrowthFixture(E, { scene: 'shore', seed: 2026 });
  runGrowthTicks(a, 300);
  const checkpoint = a.captureState();
  const b = createGrowthFixture(E, { scene: 'shore', seed: 1 });
  b.restore(checkpoint);
  runGrowthTicks(a, 300); runGrowthTicks(b, 300);
  assert.equal(hashState(a.captureState()), hashState(b.captureState()), 'restored growth state follows the same continuation');
});
