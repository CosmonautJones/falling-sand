import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/engine/world.js';
import { builtInBlueprints, validateBlueprint, transformBlueprint, placeBlueprint, captureBlueprint, createSetup } from '../public/v2/lab/blueprints.js';

const sample = { format: 'alembic-blueprint', version: 1, name: 'Tiny reactor', width: 3, height: 2, cells: [[0, 0, E.STONE, 34], [2, 1, E.WATER, 89]] };
const makeWorld = () => E.createWorld({ scene: 'empty', weather: false, ambientEmbers: false });

test('four quarter-turns return the original geometry, matter and heat', () => {
  let transformed = sample;
  for (let i = 0; i < 4; i++) transformed = transformBlueprint(transformed, 1);
  assert.deepEqual(transformed, sample);
  assert.deepEqual(transformBlueprint(sample, 1).cells, [[1, 0, E.STONE, 34], [0, 2, E.WATER, 89]]);
});

test('mirroring twice is exact and does not modify the source', () => {
  const before = structuredClone(sample);
  assert.deepEqual(transformBlueprint(transformBlueprint(sample, 0, true), 0, true), sample);
  assert.deepEqual(sample, before);
  const transformed = transformBlueprint(sample, 0, true);
  transformed.cells[0][2] = E.FIRE;
  assert.deepEqual(sample, before);
});

test('capture and JSON import roundtrip retains positioned materials and thermal state', () => {
  const world = makeWorld(), sim = world.inspect();
  placeBlueprint(world, sample, 31, 40);
  const capture = captureBlueprint(world, 33, 41, 31, 40, sample.name);
  assert.deepEqual(validateBlueprint(JSON.parse(JSON.stringify(capture))), sample);
  assert.equal(sim.cells[40 * E.W + 31], E.STONE);
  assert.equal(sim.heat[41 * E.W + 33], 89);
});

test('transparent blueprint cells preserve existing matter underneath', () => {
  const world = makeWorld(), sim = world.inspect();
  sim.setc(32, 40, E.GOLD, 0);
  placeBlueprint(world, sample, 31, 40);
  assert.equal(sim.get(32, 40), E.GOLD);
});

test('out-of-bounds and malformed placements are rejected before any mutation', () => {
  const world = makeWorld(), sim = world.inspect();
  sim.setc(20, 20, E.WATER, 0); const before = sim.cells.slice();
  for (const [x, y] of [[-1, 0], [E.W - 1, 0], [0, E.H - 1], [NaN, 2], [Infinity, 2]]) assert.throws(() => placeBlueprint(world, sample, x, y));
  assert.throws(() => placeBlueprint(world, { ...sample, cells: [...sample.cells, [1, 1, E.COUNT, 44]] }, 10, 10));
  assert.deepEqual(sim.cells, before);
});

test('imports reject invalid materials, duplicates, excessive sizes and empty content', () => {
  const invalid = [
    { ...sample, version: 99 }, { ...sample, format: 'not-a-blueprint' }, { ...sample, width: E.W + 1 }, { ...sample, height: 0 },
    { ...sample, name: '' }, { ...sample, name: 'x'.repeat(61) }, { ...sample, cells: [] },
    { ...sample, cells: [[0, 0, E.AIR, 34]] }, { ...sample, cells: [[0, 0, E.COUNT, 34]] },
    { ...sample, cells: [[0, 0, E.STONE, -1]] }, { ...sample, cells: [[0, 0, E.STONE, 256]] },
    { ...sample, cells: [[.5, 0, E.STONE, 34]] }, { ...sample, cells: [[3, 0, E.STONE, 34]] },
    { ...sample, cells: [[0, 0, E.STONE, 34], [0, 0, E.WATER, 34]] },
  ];
  for (const value of invalid) assert.throws(() => validateBlueprint(value));
});

test('oversized rotated capture is rejected and reversed capture coordinates are normalized', () => {
  assert.throws(() => transformBlueprint({ ...sample, width: 400, height: 2 }, 1));
  const world = makeWorld(); placeBlueprint(world, sample, 10, 10);
  assert.deepEqual(captureBlueprint(world, 12, 11, 10, 10, sample.name), sample);
});

test('empty captures fail with a useful error and selections clamp to world bounds', () => {
  const world = makeWorld();
  assert.throws(() => captureBlueprint(world, 10, 10, 20, 20), /empty/);
  world.inspect().setc(0, 0, E.SAND, 0);
  const capture = captureBlueprint(world, -100, -200, 1, 2);
  assert.equal(capture.width, 2); assert.equal(capture.height, 3); assert.equal(capture.cells.length, 1);
});

test('all eight builtins are valid multi-material artifacts and fit under every rotation', () => {
  const blueprints = builtInBlueprints(); assert.equal(blueprints.length, 8);
  for (const item of blueprints) {
    validateBlueprint(item.blueprint);
    assert.ok(new Set(item.blueprint.cells.map(cell => cell[2])).size >= 2, `${item.id} has interacting materials`);
    for (let turn = 0; turn < 4; turn++) validateBlueprint(transformBlueprint(item.blueprint, turn, true));
  }
  const habitat = blueprints.find(item => item.id === 'creatures').blueprint;
  for (const creature of [E.MITE, E.MINNOW, E.BEETLE, E.NEWT]) assert.ok(habitat.cells.some(cell => cell[2] === creature));
});

test('each setup creates a populated world with an anchored floor and Earth gravity', () => {
  for (const id of ['chaos', 'volcano', 'biosphere', 'magnetic', 'cryo']) {
    const world = makeWorld(); let gravity;
    const original = world.setGravity;
    world.setGravity = g => { gravity = g; original?.(g); };
    createSetup(world, id);
    assert.deepEqual(gravity, { x: 0, y: 1 });
    const sim = world.inspect();
    assert.equal(sim.get(1, E.H - 1), E.STONE);
    assert.ok(sim.cells.filter(m => m !== E.AIR).length > E.W * 7 + 500, `${id} has an experiment beyond its floor`);
  }
});

test('unknown setup does not replace an existing world', () => {
  const world = makeWorld(); world.inspect().setc(30, 30, E.GOLD, 0);
  assert.throws(() => createSetup(world, 'no-such-setup'));
  assert.equal(world.inspect().get(30, 30), E.GOLD);
});
