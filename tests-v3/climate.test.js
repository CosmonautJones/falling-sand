import test from 'node:test';
import assert from 'node:assert/strict';
import { WATER, W } from '../public/v2/engine/world.js';
import { SEASONS, seasonAt } from '../public/v3/climate.js';
import { createValley, parseValley, stringifyValley } from '../public/v3/valley.js';

test('seasons turn on simulation ticks and repeat by year', () => {
  assert.deepEqual(SEASONS.map(({ id }) => id), ['rain', 'dry', 'recovery']);
  assert.deepEqual(seasonAt(719), { id: 'rain', name: 'Rain', duration: 720, year: 1, elapsed: 719 });
  assert.equal(seasonAt(720).id, 'dry');
  assert.equal(seasonAt(1440).id, 'recovery');
  assert.deepEqual(seasonAt(2160), { id: 'rain', name: 'Rain', duration: 720, year: 2, elapsed: 0 });
});

test('seasonal rain supplies actual water across the landscape while the default stays dry', () => {
  const seasonal = createValley({ seed: 42, seasonal: true });
  const legacy = createValley({ seed: 42 });
  seasonal.advanceTicks(1);
  legacy.advanceTicks(1);
  const skyWater = (valley, x0, x1) => {
    const cells = valley.inspect().world.cells;
    let total = 0;
    for (let y = 0; y < 24; y++) for (let x = x0; x < x1; x++) total += cells[y * W + x] === WATER;
    return total;
  };
  assert.ok(skyWater(seasonal, 0, W / 2) > 50);
  assert.ok(skyWater(seasonal, W / 2, W) > 50);
  assert.equal(skyWater(legacy, 0, W), 0);
  assert.equal(legacy.stats().season, undefined);
});

test('dry weather debits exposed soil faster from identical starting soil', () => {
  const legacy = createValley({ seed: 42 });
  legacy.advanceTicks(720);
  // Establish identical water holdings without another surface inflow during the comparison.
  legacy.inspect().soil.water.fill(60);
  const seasonal = createValley({ seasonal: true });
  seasonal.restore(legacy.checkpoint());
  assert.equal(seasonal.stats().soilWater, legacy.stats().soilWater);
  assert.equal(seasonal.stats().season.id, 'dry');
  seasonal.advanceTicks(60);
  legacy.advanceTicks(60);
  assert.ok(seasonal.stats().soilWater < legacy.stats().soilWater - 300);
  assert.ok(seasonal.stats().spentWater > legacy.stats().spentWater + 300);
});

test('seasonal save restores mode and exact deterministic continuation across a season boundary', () => {
  const a = createValley({ seed: 42, seasonal: true });
  a.openDam();
  a.advanceTicks(719);
  const snapshot = parseValley(stringifyValley(a.checkpoint()));
  assert.equal(snapshot.version, 3);
  assert.equal(snapshot.seasonal, true);
  const b = createValley();
  b.restore(snapshot);
  assert.equal(b.inspect().seasonal, true);
  a.advanceTicks(42);
  b.advanceTicks(1);
  b.advanceTicks(41);
  assert.deepEqual(a.checkpoint(), b.checkpoint());
  assert.deepEqual(a.stats().season, { id: 'dry', name: 'Dry', duration: 720, year: 1, elapsed: 41 });
  const invalid = { ...snapshot, seasonal: 'true' };
  assert.throws(() => b.restore(invalid), /Invalid valley checkpoint/);
  assert.deepEqual(a.checkpoint(), b.checkpoint());
});
