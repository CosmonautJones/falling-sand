import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';

function shelf(m, x = 200) {
  const world = E.createWorld({ seed: 73, scene: 'empty', weather: false, ambientEmbers: false });
  const sim = world.inspect();
  for (let sx = x - 2; sx <= x + 2; sx++) sim.setc(sx, 101, E.STONE, 0);
  for (let sx = 0; sx < E.W; sx++) sim.setc(sx, E.H - 1, E.STONE, 0);
  sim.setc(x, 100, m, 0);
  return world;
}
function positions(world, m) {
  const result = [];
  world.inspect().cells.forEach((cell, i) => { if (cell === m) result.push([i % E.W, Math.floor(i / E.W)]); });
  return result;
}

for (const m of [E.HONEY, E.NAPALM]) {
  test(E.NAMES[m] + ' retries delayed flow and leaves the review five-cell shelf', () => {
    const normal = shelf(m), forced = shelf(m);
    for (let tick = 1; tick <= 180; tick++) {
      normal.advanceTicks(1);
      forced.inspect().dirty.fill(1); forced.advanceTicks(1);
    }
    assert.equal(positions(forced, m).length, 1, 'control conserves the grain');
    assert.equal(positions(forced, m)[0][1], E.H - 2, 'always-awake control reaches the floor');
    const actual = positions(normal, m);
    assert.equal(actual.length, 1, 'normal scheduling conserves the grain');
    assert.equal(actual[0][1], E.H - 2, 'normal grain must reach the floor, found ' + JSON.stringify(actual));
  });

  test(E.NAMES[m] + ' with no legal move still sleeps and wakes when its wall is opened', () => {
    const world = E.createWorld({ seed: 73, scene: 'empty', weather: false, ambientEmbers: false });
    const sim = world.inspect();
    for (let y = 99; y <= 101; y++) for (let x = 199; x <= 201; x++) sim.setc(x, y, E.STONE, 0);
    sim.setc(200, 100, m, 0);
    world.advanceTicks(30);
    assert.equal(sim.awake.reduce((n, v) => n + v, 0), 0, 'blocked liquid does not keep chunks awake');
    assert.deepEqual(positions(world, m), [[200, 100]]);
    sim.setc(200, 101, E.AIR, 0);
    world.advanceTicks(1);
    assert.deepEqual(positions(world, m), [[200, 101]], 'editing support wakes the grain');
  });

  test(E.NAMES[m] + ' delayed flow repeats and continues exactly from a checkpoint at a chunk edge', () => {
    const a = shelf(m, 7), b = shelf(m, 7);
    a.advanceTicks(3); b.advanceTicks(3);
    assert.deepEqual(a.captureState(), b.captureState(), 'same seed and ticks repeat');
    const checkpoint = structuredClone(a.captureState());
    a.advanceTicks(177); b.advanceTicks(177);
    assert.deepEqual(a.captureState(), b.captureState(), 'continued run repeats');
    assert.equal(positions(a, m)[0][1], E.H - 2, 'chunk-edge grain reaches the floor');
    b.restore(checkpoint); b.advanceTicks(177);
    assert.deepEqual(b.captureState(), a.captureState(), 'checkpoint preserves exact continuation');
  });
}

test('a refused liquid density swap retries until water layers below oil, then sleeps', () => {
  const make = () => {
    const world = E.createWorld({ seed: 6, scene: 'empty', weather: false, ambientEmbers: false }), sim = world.inspect();
    for (let y = 99; y <= 102; y++) for (let x = 199; x <= 201; x++) sim.setc(x, y, E.STONE, 0);
    sim.setc(200, 100, E.WATER, 0); sim.setc(200, 101, E.OIL, 0);
    return world;
  };
  const normal = make(), forced = make();
  for (let tick = 0; tick < 30; tick++) {
    normal.advanceTicks(1); forced.inspect().dirty.fill(1); forced.advanceTicks(1);
  }
  assert.equal(forced.inspect().get(200, 101), E.WATER, 'always-awake control layers');
  assert.equal(normal.inspect().get(200, 101), E.WATER, 'the lighter oil must not strand water above it');
  assert.deepEqual(positions(normal, E.WATER), [[200, 101]]);
  assert.deepEqual(positions(normal, E.OIL), [[200, 100]]);
  assert.equal(normal.inspect().awake.reduce((n, v) => n + v, 0), 0, 'correctly layered blocked liquids sleep');
});

for (const m of [E.HONEY, E.NAPALM]) {
  test(E.NAMES[m] + ' retries when its only escape is diagonal', () => {
    const world = shelf(m), sim = world.inspect();
    for (let y = 99; y <= 101; y++) for (let x = 199; x <= 201; x++) sim.setc(x, y, E.STONE, 0);
    sim.setc(199, 101, E.AIR, 0); sim.setc(200, 100, m, 0);
    world.advanceTicks(180);
    assert.equal(positions(world, m).length, 1, 'the grain is conserved');
    assert.equal(positions(world, m)[0][1], E.H - 2, 'the grain leaves through its diagonal opening');
  });
}
