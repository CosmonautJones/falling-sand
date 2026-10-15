import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';

const count = (sim, material) => sim.cells.reduce((n, cell) => n + (cell === material), 0);

// A cold liquid strip beside ice, with weather and ambient ember rain disabled.
function strip(material, heat) {
  const world = E.createWorld({ seed: 0xa341316c, scene: 'empty', weather: false, ambientEmbers: false });
  const sim = world.inspect();
  for (let y = 40; y < E.H; y++) for (let x = 0; x < 60; x++) sim.setc(x, y, E.STONE, 0);
  for (let y = 30; y < 39; y++) {
    for (let x = 20; x <= 29; x++) { sim.setc(x, y, material, 0); if (heat !== undefined) sim.heat[y * E.W + x] = heat; }
    for (let x = 30; x <= 32; x++) sim.setc(x, y, E.ICE, 0);
  }
  return { world, sim };
}

test('ice contact can freeze prechilled water during calm weather without losing material', () => {
  const { world, sim } = strip(E.WATER, 0);
  const stone = count(sim, E.STONE);
  assert.equal(count(sim, E.ICE), 27);
  assert.equal(count(sim, E.WATER), 90);
  world.advanceTicks(2);
  assert.ok(count(sim, E.ICE) > 27, 'cold water freezes through ice contact alone');
  assert.equal(count(sim, E.ICE) + count(sim, E.WATER), 117);
  assert.equal(count(sim, E.STONE), stone);
});

test('prechilled brine resists passive ice-contact freezing', () => {
  const { world, sim } = strip(E.BRINE, 0);
  world.advanceTicks(2);
  assert.equal(count(sim, E.BRINE), 90);
  assert.equal(count(sim, E.ICE), 27);
});

// Enclose one liquid grain so it cannot move and the weather surface sweep
// cannot reach it. Only ice-contact freezing can convert this center grain.
function pocket(material, cold = false) {
  const engine = E.createEngine({ seed: 3, scene: 'empty', weather: cold, ambientEmbers: false });
  if (cold) {
    let spell = 2;
    while (spell < 200 && E.climateAt(3, spell * E.CLIMATE.spell + 1400) > -0.9) spell++;
    assert.ok(spell < 200, 'fixed seed has a full cold snap');
    const cp = engine.checkpoint(); cp.tick = cp.state.tickIndex = spell * E.CLIMATE.spell + 1400; engine.restore(cp);
  }
  const sim = engine.inspect(), x = 240, y = 230;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sim.setc(x + dx, y + dy, E.ICE, 0);
  sim.setc(x, y, material, 0);
  return { engine, sim, center: y * E.W + x };
}

test('ordinary water does not freeze merely because it touches ice in calm weather', () => {
  const { engine, sim, center } = pocket(E.WATER);
  engine.advanceTicks(120);
  assert.equal(sim.cells[center], E.WATER);
  assert.equal(count(sim, E.WATER), 1);
  assert.equal(count(sim, E.ICE), 8);
});

test('a cold snap enables ice-contact freezing below its raised threshold', () => {
  const { engine, sim, center } = pocket(E.WATER, true);
  engine.advanceTicks(120);
  assert.equal(sim.cells[center], E.ICE, 'enclosed water freezes without a surface-weather conversion');
  assert.equal(count(sim, E.ICE), 9);
  assert.equal(count(sim, E.WATER), 0);
});

test('brine resists passive freezing even in an ice pocket during a cold snap', () => {
  const { engine, sim, center } = pocket(E.BRINE, true);
  engine.advanceTicks(120);
  assert.equal(sim.cells[center], E.BRINE);
  assert.equal(count(sim, E.BRINE), 1);
  assert.equal(count(sim, E.ICE), 8);
});

test('the cooling wand freezes water through the normal tick-command path', () => {
  const { engine, sim, center } = pocket(E.WATER);
  const commands = Array.from({ length: 20 }, (_, i) => ({ tick: i + 1, sequence: i, op: { t: 'cool', x: 240, y: 230, r: 1 } }));
  engine.advanceTicks(20, commands);
  assert.equal(sim.cells[center], E.ICE);
  assert.equal(count(sim, E.ICE), 9);
  assert.equal(count(sim, E.WATER), 0);
});
