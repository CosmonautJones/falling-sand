import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createTerrain } from '../public/v3/terrain.js';
import { createValley, stringifyValley, parseValley } from '../public/v3/valley.js';
import {
  parseSeed,
  seedFromSearch,
  seedSearch,
  differentSeed,
  DEFAULT_SEED,
} from '../public/v3/seed.js';

test('seed input accepts the uint32 range and rejects partial, signed and overflowing numbers', () => {
  for (const [text, expected] of [
    ['0', 0],
    [' 73 ', 73],
    ['00012', 12],
    ['4294967295', 0xffffffff],
  ])
    assert.equal(parseSeed(text), expected);
  for (const text of ['', ' ', '-1', '+2', '1.5', '1e2', '0x12', '12oops', '4294967296', null])
    assert.equal(parseSeed(text), null);
  assert.equal(differentSeed(0xffffffff, 0xffffffff), 0);
  assert.equal(differentSeed(12, 12), 13);
  assert.equal(differentSeed(12, 13), 12);
});

test('old seed links retain original terrain and new links round-trip their generator', () => {
  assert.deepEqual(seedFromSearch('?seed=73'), { seed: 73, terrainVersion: 1 });
  assert.deepEqual(seedFromSearch(''), { seed: DEFAULT_SEED, terrainVersion: 2 });
  assert.deepEqual(seedFromSearch('?seed=invalid'), { seed: DEFAULT_SEED, terrainVersion: 2 });
  for (const terrainVersion of [1, 2]) {
    const search = seedSearch('?other=keep', 0xffffffff, terrainVersion);
    assert.deepEqual(seedFromSearch(search), { seed: 0xffffffff, terrainVersion });
    assert.equal(new URLSearchParams(search).get('other'), 'keep');
  }
});

test('landforms stay bounded, connected to the outfall and contained across 256 seeds', () => {
  const names = new Set(),
    hashes = new Set();
  for (const seed of [0xffffffff, ...Array.from({ length: 255 }, (_, i) => i * 16843009)]) {
    const terrain = createTerrain(seed);
    names.add(terrain.name);
    hashes.add(createHash('sha256').update(terrain.surface).digest('hex'));
    assert.deepEqual(terrain, createTerrain(seed));
    assert.equal(terrain.surface.length, 480);
    assert.ok(terrain.surface.every((y) => y >= 110 && y <= 244));
    assert.ok(terrain.surface.slice(164, 208).every((y) => y > 140));
    assert.ok(terrain.surface[479] < Math.max(...terrain.surface) - 20);
    for (let x = 1; x < 480; x++)
      assert.ok(Math.abs(terrain.surface[x] - terrain.surface[x - 1]) <= 4);
  }
  assert.equal(names.size, 3);
  assert.ok(hashes.size > 240);
  assert.throws(() => createTerrain(-1), /Invalid/);
  assert.throws(() => createTerrain(2, 3), /Invalid/);
});

test('old starting worlds match the source checkpoint and old saves retain same-seed resets', () => {
  const original = createValley({ seed: 12, terrainVersion: 1 }).checkpoint();
  original.version = 1;
  delete original.terrainVersion;
  assert.equal(
    createHash('sha256').update(JSON.stringify(original)).digest('hex'),
    'cef1027e9dfddd4b4b7d0b28c57d87c005ec34cdb71f12899a672a0dd1db668a',
  );
  const restored = createValley({ seed: 73 });
  restored.restore(original);
  assert.equal(restored.inspect().terrainVersion, 1);
  const replay = createValley({
    seed: restored.inspect().seed,
    terrainVersion: restored.inspect().terrainVersion,
  });
  assert.deepEqual(restored.checkpoint(), replay.checkpoint());
  const upgraded = parseValley(stringifyValley(original));
  assert.equal(upgraded.version, 2);
  assert.equal(upgraded.terrainVersion, 1);
});

test('new terrain saves reject invalid versions atomically and continue exactly', () => {
  const a = createValley({ seed: 0xffffffff });
  a.openDam();
  a.advanceTicks(125);
  const saved = a.checkpoint(),
    b = createValley({ seed: 0 });
  b.restore(parseValley(stringifyValley(saved)));
  a.advanceTicks(65);
  b.advanceTicks(65);
  assert.deepEqual(a.checkpoint(), b.checkpoint());
  const before = b.checkpoint();
  for (const version of [0, 3, '2', null]) {
    const bad = structuredClone(saved);
    bad.terrainVersion = version;
    assert.throws(() => b.restore(bad), /Invalid valley/);
    assert.deepEqual(b.checkpoint(), before);
  }
});

test('different landforms produce different flood habitats while conserving soil nutrients', () => {
  const distributions = [];
  for (const seed of [1, 12, 13]) {
    const valley = createValley({ seed }),
      total = valley.stats().nutrientUnits;
    valley.openDam();
    valley.advanceTicks(600);
    assert.ok(valley.stats().absorbed > 100);
    assert.ok(valley.stats().plantGrains > 0);
    assert.equal(valley.stats().nutrientUnits, total);
    distributions.push(valley.inspect().soil.water.slice(24, 58));
  }
  for (let i = 0; i < distributions.length; i++)
    for (let j = 0; j < i; j++)
      assert.ok(
        distributions[i].filter((water, q) => Math.abs(water - distributions[j][q]) >= 4).length >=
          6,
      );
});
