import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  W,
  STONE,
  SEED,
  WATER,
  PLANT,
  MUD,
  WOOD,
  MITE,
  FUNGUS,
} from '../public/v2/engine/world.js';
import { createRandom } from '../public/v2/engine/random.js';
function fixture(vegetation) {
  const world = createWorld({ seed: 73, scene: 'empty', vegetation, ambientEmbers: false });
  const sim = world.inspect();
  for (let x = 90; x <= 110; x++) sim.setc(x, 199, STONE, 0);
  return { world, sim };
}
function firstZero(world, n) {
  let seed = 0;
  while (createRandom(seed).int(n) !== 0) seed++;
  const state = world.captureState();
  state.random.ecology = seed;
  world.restore(state);
}
test('managed seeds remain dormant while native wet seeds become plant grains', () => {
  for (const mode of ['native', 'managed']) {
    const { world, sim } = fixture(mode);
    sim.setc(100, 198, SEED, 0);
    sim.setc(101, 198, WATER, 0);
    world.advanceTicks(1);
    assert.equal(sim.cells.includes(PLANT), mode === 'native');
    assert.equal(sim.cells.includes(SEED), mode === 'managed');
  }
});
test('managed wood does not enter native fungus propagation', () => {
  for (const mode of ['native', 'managed']) {
    const { world, sim } = fixture(mode);
    sim.setc(100, 198, WOOD, 0);
    sim.setc(101, 198, MUD, 0);
    firstZero(world, 400);
    world.advanceTicks(1);
    assert.equal(sim.cells.includes(FUNGUS), mode === 'native');
  }
});
test('managed wet mud and plants do not hatch native unfunded mites', () => {
  for (const mode of ['native', 'managed']) {
    const { world, sim } = fixture(mode);
    sim.setc(100, 198, MUD, 0);
    sim.setc(101, 198, PLANT, 0);
    sim.setc(100, 197, WATER, 0);
    firstZero(world, 8);
    world.advanceTicks(1);
    assert.equal(sim.cells.includes(MITE), mode === 'native');
    assert.equal(sim.cells[198 * W + 100], MUD);
  }
});
