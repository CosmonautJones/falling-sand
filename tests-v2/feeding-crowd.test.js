import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';

const ECOLOGY_SEED = 42;
const PARENT = { x: 200, y: 230 };
const FOOD = { x: 201, y: 230 };
const FLOOR_Y = 231;
const ABOVE = [{ x: 199, y: 229 }, { x: 200, y: 229 }, { x: 201, y: 229 }];

function setEcologySeed(world, seed = ECOLOGY_SEED) {
  const state = world.captureState();
  state.random.ecology = seed >>> 0;
  world.restore(state);
}

function createFeedingFixture({ vegetation = 'native', neighbors = 2, food = E.PLANT } = {}) {
  const world = E.createWorld({ seed: 17, scene: 'empty', vegetation, weather: false, ambientEmbers: false });
  const sim = world.inspect();
  for (let x = 197; x <= 203; x++) sim.setc(x, FLOOR_Y, E.STONE, 0);
  sim.setc(198, 229, E.STONE, 0); sim.setc(202, 229, E.STONE, 0);
  sim.setc(PARENT.x, PARENT.y, E.MITE, 0);
  for (const [index, point] of ABOVE.entries()) if (index < neighbors) sim.setc(point.x, point.y, E.MITE, 0);
  sim.setc(FOOD.x, FOOD.y, food, 0);
  setEcologySeed(world);
  return world;
}

function count(world, material) {
  return world.inspect().cells.reduce((total, cell) => total + (cell === material ? 1 : 0), 0);
}

for (const food of [E.PLANT, E.HONEY]) {
  test(`native sparse feeding births beside ${E.NAMES[food]}`, () => {
    const world = createFeedingFixture({ food, neighbors: 2 });
    const sim = world.inspect();
    assert.equal(count(world, E.MITE), 3);
    world.advanceTicks(1);
    assert.equal(count(world, E.MITE), 4, 'a sparse native parent creates one child');
    assert.equal(sim.get(FOOD.x, FOOD.y), E.AIR, 'the food source is consumed');
    assert.equal(sim.get(PARENT.x, PARENT.y), E.MITE, 'the feeding parent remains');
    assert.deepEqual(ABOVE.slice(0, 2).map(point => sim.get(point.x, point.y)), [E.MITE, E.MITE]);
    assert.equal(count(world, E.ASH), 0, 'the parent and its neighbors survive');
    assert.ok(sim.cells.some((cell, i) => cell === E.MITE && sim.born[i] === 1), 'the child is marked born');
  });

  test(`native crowded feeding consumes ${E.NAMES[food]} without birth`, () => {
    const world = createFeedingFixture({ food, neighbors: 3 });
    const sim = world.inspect();
    assert.equal(count(world, E.MITE), 4);
    world.advanceTicks(1);
    assert.equal(count(world, E.MITE), 4, 'the native crowd cap suppresses the child');
    assert.equal(sim.get(FOOD.x, FOOD.y), E.AIR, 'crowded feeding still consumes the source');
    assert.deepEqual(ABOVE.map(point => sim.get(point.x, point.y)), [E.MITE, E.MITE, E.MITE]);
    assert.equal(count(world, E.ASH), 0, 'the crowded parent and neighbors survive');
  });

  test(`managed crowded feeding still births beside ${E.NAMES[food]}`, () => {
    const world = createFeedingFixture({ food, neighbors: 3, vegetation: 'managed' });
    const sim = world.inspect();
    assert.equal(count(world, E.MITE), 4);
    world.advanceTicks(1);
    assert.equal(count(world, E.MITE), 5, 'managed vegetation preserves inherited feeding births');
    assert.equal(sim.get(FOOD.x, FOOD.y), E.AIR, 'the managed source is consumed');
    assert.deepEqual(ABOVE.map(point => sim.get(point.x, point.y)), [E.MITE, E.MITE, E.MITE]);
    assert.equal(count(world, E.ASH), 0, 'the managed parent and neighbors survive');
    assert.ok(sim.cells.some((cell, i) => cell === E.MITE && sim.born[i] === 1), 'the managed child is marked born');
  });
}
