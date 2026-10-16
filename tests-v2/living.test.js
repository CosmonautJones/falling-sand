import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as E from '../public/v2/alembic-engine-v2.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const fingerprint = state => createHash('sha256').update(JSON.stringify(state, (_, value) =>
  ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') : value
)).digest('hex');

// A walled basin on a stone floor, the same in every scene.
function basin(seed = 1, options = {}) {
  const s = E.createTestWorld({ seed, ...options });
  const box = (x0, y0, x1, y1, m) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.setc(x, y, m, 0); };
  box(0, 260, 479, 269, E.STONE); box(100, 200, 100, 259, E.STONE); box(300, 200, 300, 259, E.STONE);
  return { s, box, run: secs => { for (let i = 0; i < secs * 60; i++) s.step(); }, count: m => s.cells.reduce((n, c) => n + (c === m), 0) };
}
const meanY = (s, m) => { let t = 0, n = 0; s.cells.forEach((c, i) => { if (c === m) { t += (i / E.W) | 0; n++; } }); return n ? t / n : NaN; };

// ---------- minnows ----------
test('a beached school of minnows falls instead of hanging in the air', () => {
  const { s, box, run } = basin();
  box(150, 120, 156, 126, E.MINNOW);
  const y0 = meanY(s, E.MINNOW);
  run(2);
  assert.ok(meanY(s, E.MINNOW) > y0 + 60, 'the school drops toward the floor');
});

test('minnows gasp on land but live on in water', () => {
  const land = basin(); land.box(150, 250, 160, 259, E.MINNOW); land.run(10);
  assert.ok(land.count(E.MINNOW) < 121 * 0.8, 'exposed minnows die on land');
  assert.ok(land.count(E.ASH) > 0, 'and leave ash');
  const pool = basin(); pool.box(101, 220, 299, 259, E.WATER); pool.box(190, 240, 196, 244, E.MINNOW); pool.run(20);
  assert.equal(pool.count(E.MINNOW), 35, 'no minnow dies in water');
});

// ---------- mites ----------
test('mites drown under water and freeze when sealed in ice', () => {
  const wet = basin(); wet.box(101, 220, 299, 259, E.WATER);
  for (let k = 0; k < 20; k++) wet.s.setc(120 + k * 8, 240, E.MITE, 0);
  wet.run(15);
  assert.ok(wet.count(E.MITE) <= 3, 'almost every submerged mite drowns');
  const ice = basin(); ice.box(150, 230, 170, 259, E.ICE);
  for (let k = 0; k < 6; k++) ice.s.setc(152 + k * 3, 245, E.MITE, 0);
  ice.run(20);
  assert.equal(ice.count(E.MITE), 0, 'mites sealed in ice die');
});

test('food supports an early colony boom and better survival through a finite garden', () => {
  const calm = { weather: false, ambientEmbers: false };
  const dry = basin(1, calm); dry.box(101, 240, 299, 259, E.SAND);
  for (let k = 0; k < 40; k++) dry.s.setc(110 + k * 4, 239, E.MITE, 0);
  dry.run(240);
  const starved = dry.count(E.MITE);
  assert.ok(starved < 30, `starving mites thin out (${starved} of 40 left)`);
  const fed = basin(1, calm); fed.box(101, 240, 299, 259, E.MUD); fed.box(101, 235, 299, 239, E.PLANT);
  fed.box(101, 234, 299, 234, E.WATER);
  for (let k = 0; k < 30; k++) fed.s.setc(110 + k * 6, 234, E.MITE, 0);
  let peak = 30;
  for (let i = 0; i < 8; i++) { fed.run(30); peak = Math.max(peak, fed.count(E.MITE)); }
  const survivors = fed.count(E.MITE);
  assert.ok(peak > 30, `the garden supports new mites (${peak})`);
  assert.ok(survivors / 30 > starved / 40, `food improves survival (${survivors}/30 vs ${starved}/40)`);
  assert.ok(survivors < peak, 'the finite garden limits the initial boom');
});

test('creature lifetimes are named in one table', () => {
  for (const key of ['minnowGasp', 'miteAge', 'miteHunger', 'miteDrown', 'miteFreeze']) assert.ok(E.LIFE[key] > 0, key);
  assert.ok(Object.isFrozen(E.LIFE));
});

// ---------- cold and heat ----------
test('heat exchange no longer drains toward the coldest grain', () => {
  const { s, box, run } = basin();
  box(101, 220, 299, 259, E.WATER); box(190, 225, 200, 235, E.ICE);
  run(10);
  assert.ok(s.heat[240 * E.W + 130] >= 28, `far water stays warm (${s.heat[240 * E.W + 130]})`);
});

test('ice no longer swallows a warm pool; it melts back instead', () => {
  const { box, run, count } = basin();
  box(101, 220, 299, 259, E.WATER); box(190, 225, 200, 235, E.ICE);
  run(15); const mid = count(E.ICE);
  assert.ok(mid < 121, `the block shrinks (${mid})`);
  run(45);
  assert.ok(count(E.ICE) < mid, 'and keeps melting');
});

test('lava melts ice to water instead of crusting on first touch', () => {
  const { box, run, count } = basin();
  box(101, 245, 299, 259, E.ICE); box(180, 225, 200, 240, E.LAVA);
  run(20);
  assert.ok(count(E.WATER) + count(E.STEAM) > 300, 'plenty of ice has melted');
  assert.ok(count(E.LAVA) > 200, 'most of the lava is still molten');
});

test('cold and heat tuning lives in one table', () => {
  for (const key of ['iceRest', 'freezeBelow', 'thawAbove', 'thawOdds', 'freezeOdds', 'meltAt', 'lavaCrustOnIce']) assert.ok(E.COLD[key] > 0, key);
  assert.ok(E.COLD.freezeBelow < E.COLD.thawAbove, 'there is a band where ice and water coexist');
});

// ---------- weather ----------
const findSpell = (seed, level) => { for (let k = 2; k < 200; k++) if (E.climateLevel(seed, k) === level && E.climateLevel(seed, k + 1) === level) return k; return -1; };
function engineAt(seed, tick) {
  const e = E.createEngine({ seed, scene: 'empty' });
  const cp = e.checkpoint(); cp.tick = tick; cp.state.tickIndex = tick;
  e.restore(cp);
  return e;
}

test('the climate is calm at first, then drifts through warm spells and cold snaps', () => {
  for (let t = 0; t < E.CLIMATE.spell * E.CLIMATE.calmSpells; t += 97) assert.equal(E.climateAt(7, t), 0, 'calm opening');
  const seen = new Set();
  for (let t = 0; t < E.CLIMATE.spell * 60; t += 600) { const v = E.climateAt(7, t); assert.ok(v >= -1 && v <= 1); seen.add(Math.sign(v)); }
  assert.deepEqual([...seen].sort(), [-1, 0, 1], 'all three kinds of weather occur');
  assert.equal(E.climateAt(7, 123456), E.climateAt(7, 123456), 'same seed and tick, same weather');
});

test('a cold snap skins still water with ice and turns storm rain to snow', () => {
  const k = findSpell(3, -1); assert.ok(k > 0);
  const e = engineAt(3, k * E.CLIMATE.spell + 10), w = e.inspect();
  for (let y = 200; y < 260; y++) for (let x = 101; x < 300; x++) w.setc(x, y, E.WATER, 0);
  for (let x = 0; x < 480; x++) for (let y = 260; y < 270; y++) w.setc(x, y, E.STONE, 0);
  e.advanceTicks(60 * 20);
  let ice = 0; for (const c of w.cells) if (c === E.ICE) ice++;
  assert.ok(ice > 20, `the pool surface freezes (${ice} ice)`);
  assert.match(readFileSync(new URL('../public/v2/engine/world.js', import.meta.url), 'utf8'), /transmute\(x, y \+ 1, cold >= 0\.5 \? SNOW : WATER\)/);
});

test('a warm spell melts ice open to the air', () => {
  const k = findSpell(5, 1); assert.ok(k > 0);
  const slab = tick => {
    const e = engineAt(5, tick), w = e.inspect();
    for (let x = 0; x < 480; x++) for (let y = 260; y < 270; y++) w.setc(x, y, E.STONE, 0);
    for (let y = 240; y < 260; y++) for (let x = 150; x < 180; x++) w.setc(x, y, E.ICE, 0);
    e.advanceTicks(60 * 60);
    let ice = 0; for (const c of w.cells) if (c === E.ICE) ice++;
    return ice;
  };
  const calm = slab(100), warm = slab(k * E.CLIMATE.spell + 1400);
  assert.equal(calm, 600, 'in calm air an ice slab keeps');
  assert.ok(warm < 560, `in a warm spell it wastes away (${warm} of 600 left)`);
});

test('weather replays exactly from a checkpoint taken mid-spell', () => {
  const k = findSpell(9, -1);
  const a = engineAt(9, k * E.CLIMATE.spell + 50), w = a.inspect();
  for (let y = 230; y < 260; y++) for (let x = 120; x < 260; x++) w.setc(x, y, E.WATER, 0);
  a.advanceTicks(120);
  const b = E.createEngine({ seed: 9, scene: 'empty' }); b.restore(a.checkpoint());
  a.advanceTicks(300); b.advanceTicks(300);
  assert.equal(fingerprint(a.captureState()), fingerprint(b.captureState()));
});

test('storms gust sideways after they build, and the page draws the gust', () => {
  const e = E.createEngine({ seed: 2, scene: 'empty' });
  const early = e.advanceTicks(1, [{ tick: 1, sequence: 0, op: { t: 'tempest' } }]);
  assert.ok(!early.some(ev => ev.t === 'gust'), 'no gust the moment a storm starts');
  const later = e.advanceTicks(E.CLIMATE.gustEvery + 5);
  const gust = later.find(ev => ev.t === 'gust');
  assert.ok(gust && (gust.dir === 1 || gust.dir === -1), 'a gust arrives with a direction');
  assert.match(html, /case 'gust': this\.gustDir = e\.dir;/);
  assert.match(html, /case 'climate': this\.setState\(\{ whisper: CLIMATE_WHISPER\[e\.v\]/);
  assert.match(html, /climateLabel\(this\.climate\)/);
});

test('warmed or chilled things settle back to their resting heat', () => {
  const { s, box, run } = basin();
  box(101, 220, 299, 259, E.WATER);
  for (let y = 220; y < 260; y++) for (let x = 101; x < 300; x++) s.heat[y * E.W + x] = 60;
  box(350, 230, 400, 259, E.STONE);
  for (let y = 230; y < 260; y++) for (let x = 350; x <= 400; x++) s.heat[y * E.W + x] = (x * 13 + y * 7) % 41;
  run(60);
  const water = s.heat[240 * E.W + 200], stone = s.heat[245 * E.W + 375];
  assert.ok(water >= 30 && water <= 38, `warm water cools back toward 34 (${water})`);
  assert.ok(stone >= 14 && stone <= 22, `stone settles near 18 (${stone})`);
});

test('a cold snap reaches a pool that has already settled and gone to sleep', () => {
  const k = findSpell(3, -1);
  const e = engineAt(3, 200), w = e.inspect();
  for (let x = 0; x < 480; x++) for (let y = 260; y < 270; y++) w.setc(x, y, E.STONE, 0);
  for (let y = 220; y < 260; y++) for (let x = 101; x < 300; x++) w.setc(x, y, E.WATER, 0);
  e.advanceTicks(60 * 20);
  const cp = e.checkpoint(); cp.tick = cp.state.tickIndex = k * E.CLIMATE.spell + 1400;
  e.restore(cp); e.advanceTicks(60 * 10);
  for (let y = 0; y < 260; y++) for (let x = 0; x < 480; x++) if (w.cells[y * E.W + x] === E.ICE) w.setc(x, y, E.WATER, 0);
  e.advanceTicks(60 * 40);
  let ice = 0; for (const c of w.cells) if (c === E.ICE) ice++;
  assert.ok(ice > 10, `the sleeping pool still skins over (${ice} ice)`);
});

test('Living Valley keeps its own weather: the climate is off there', () => {
  const k = findSpell(3, -1);
  const e = E.createEngine({ seed: 3, scene: 'empty', weather: false });
  const cp = e.checkpoint(); cp.tick = cp.state.tickIndex = k * E.CLIMATE.spell + 1400; e.restore(cp);
  const buf = () => new Uint8Array(E.N * 4);
  const frame = e.tick({ dt: 1000 / 60, speed: 1 }, buf(), buf(), buf());
  assert.equal(frame.climate, 0);
  assert.match(readFileSync(new URL('../public/v3/valley.js', import.meta.url), 'utf8'), /ambientEmbers: false, weather: false/);
});
