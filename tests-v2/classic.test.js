import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';
import { validateOperations, validateCheckpoint } from '../public/v2/engine/checkpoint.js';

// The classic pack: napalm, methane, wax, molten wax, concrete, c-4, fuse, cryo and the font.
const NEW = ['NAPALM', 'METHANE', 'WAX', 'MOLTEN_WAX', 'CONCRETE', 'C4', 'FUSE', 'CRYO', 'FONT'];
const FLOOR = 260;

function world(seed = 3) {
  const w = E.createWorld({ seed, scene: 'empty', ambientEmbers: false, weather: false }), s = w.inspect();
  for (let x = 0; x < E.W; x++) for (let y = FLOOR; y < E.H; y++) s.setc(x, y, E.STONE, 0);
  const box = (x0, y0, x1, y1, m) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.setc(x, y, m, 0); };
  const count = m => s.cells.reduce((n, c) => n + (c === m), 0);
  const at = (x, y) => s.cells[y * E.W + x];
  const run = n => w.advanceTicks(n);
  return { w, s, box, count, at, run };
}
const lit = (s, x, y) => s.shades[y * E.W + x] >= E.CLASSIC.lit;

test('nine new materials fill the tables to their 64-slot limit, each with a page and a hint', () => {
  assert.equal(E.COUNT, 64);
  for (const name of NEW) {
    const id = E[name];
    assert.ok(Number.isInteger(id) && id >= 55 && id < E.COUNT, name);
    assert.ok(E.TRANSMUTED.includes(id), `${name} is discoverable`);
    assert.ok(E.PAGES[id]?.w && E.PAGES[id]?.l, `${name} page`);
    assert.ok(E.HINTS[id], `${name} hint`);
    assert.equal(E.COLORS[id].length, 3);
  }
  assert.equal(E.NAMES.length, E.COUNT); assert.equal(E.PAGES.length, E.COUNT); assert.equal(E.COLORS.length, E.COUNT);
  assert.equal(new Set(E.NAMES).size, E.COUNT, 'names are unique');
});

// ---------- napalm ----------
test('napalm: oil beside sulfur turns to napalm', () => {
  const { box, count, run } = world();
  box(100, 255, 120, 259, E.OIL); box(110, 254, 112, 254, E.SULFUR);
  run(60);
  assert.ok(count(E.NAPALM) > 0, 'napalm formed');
});

test('napalm: once lit it burns for seconds, and water only boils against it', () => {
  const { s, box, count, run } = world();
  box(100, 255, 129, 259, E.NAPALM); s.setc(115, 254, E.FIRE, 0);
  run(120);
  assert.equal(count(E.NAPALM), 150, 'still all there after two seconds');
  let litN = 0; for (let x = 100; x < 130; x++) for (let y = 255; y < 260; y++) if (s.cells[y * E.W + x] === E.NAPALM && lit(s, x, y)) litN++;
  assert.ok(litN > 100, `the whole pool caught (${litN})`);
  run(600);
  assert.equal(count(E.NAPALM), 0, 'and burned away within ten seconds');
  const b = world();
  b.box(95, 240, 95, 259, E.GLASS); b.box(135, 240, 135, 259, E.GLASS);
  b.box(100, 250, 129, 259, E.NAPALM); b.s.setc(115, 249, E.FIRE, 0);
  b.run(30);
  b.box(100, 240, 129, 245, E.WATER);
  b.run(90);
  assert.ok(b.count(E.STEAM) > 0, 'water boils against it');
  let still = 0; for (let x = 100; x < 130; x++) for (let y = 240; y < 260; y++) if (b.at(x, y) === E.NAPALM && lit(b.s, x, y)) still++;
  assert.ok(still > 20, `water does not put it out (${still} still burning)`);
});

// ---------- methane ----------
test('methane: fungus beside water breathes swamp gas', () => {
  const { box, count, run } = world();
  box(150, 250, 210, 259, E.WATER); box(150, 259, 210, 259, E.FUNGUS);
  let gas = 0; for (let t = 0; t < 600; t++) { run(1); gas = Math.max(gas, count(E.METHANE)); }
  assert.ok(gas > 0, 'methane bubbles up');
});

test('methane rises, and a pocket under a ceiling flashes and goes off at a spark', () => {
  const { s, box, count, run } = world();
  box(200, 250, 220, 256, E.METHANE);
  run(60);
  let top = E.H; s.cells.forEach((c, i) => { if (c === E.METHANE) top = Math.min(top, (i / E.W) | 0); });
  assert.ok(top < 245, `it rises (top row ${top})`);
  const b = world();
  b.box(190, 200, 230, 200, E.STONE); b.box(200, 201, 220, 206, E.METHANE);
  b.s.setc(210, 207, E.FIRE, 0);
  const events = [];
  for (let t = 0; t < 30; t++) events.push(...b.run(1));
  assert.equal(b.count(E.METHANE), 0, 'the pocket burned off');
  assert.ok(events.some(e => e.t === 'blast'), 'and went off');
});

// ---------- wax ----------
test('wax: honey against ice sets as wax; heat melts it and it sets again as it cools', () => {
  const { box, count, run } = world();
  box(100, 255, 110, 259, E.HONEY); box(111, 255, 112, 259, E.ICE);
  run(300);
  assert.ok(count(E.WAX) > 0, 'wax formed');
  const b = world();
  b.box(100, 250, 110, 259, E.WAX);
  for (let t = 0; t < 30; t++) b.w.advanceTicks(1, [{ tick: b.w.captureState().tickIndex + 1, sequence: 0, op: { t: 'heat', x: 105, y: 252, r: 3 } }]);
  const molten = b.count(E.MOLTEN_WAX);
  assert.ok(molten > 0, `heat melts it (${molten})`);
  b.run(60 * 20);
  assert.ok(b.count(E.MOLTEN_WAX) < molten, 'and the melt sets again as it cools');
});

test('wax: a flame on a column burns down slowly like a candle; water sets molten wax at once', () => {
  const { s, box, count, run } = world();
  box(200, 230, 202, 259, E.WAX); s.setc(201, 229, E.FIRE, 0);
  run(60 * 3);
  assert.ok(count(E.FIRE) > 0, 'the flame keeps burning on the wax');
  assert.ok(count(E.WAX) > 60, `three seconds in, most of the candle stands (${count(E.WAX)} of 90)`);
  run(60 * 20);
  let top = E.H; for (let y = 0; y < E.H; y++) if (s.cells[y * E.W + 201] === E.WAX) { top = y; break; }
  assert.ok(top > 233, `the flame ate down the middle of it (wax now starts at row ${top})`);
  assert.ok(count(E.WAX) > 0, 'without vanishing at once');
  const b = world();
  b.box(100, 255, 130, 259, E.WATER); b.box(110, 250, 112, 252, E.MOLTEN_WAX);
  b.run(120);
  assert.equal(b.count(E.MOLTEN_WAX), 0, 'water sets it');
  assert.ok(b.count(E.WAX) > 0);
});

// ---------- concrete ----------
test('concrete: mud beside pumice makes concrete, which sinks through water', () => {
  const a = world();
  a.box(100, 255, 110, 259, E.MUD); a.box(111, 255, 111, 259, E.PUMICE);
  a.run(120);
  assert.ok(a.count(E.CONCRETE) > 0, 'concrete formed');
  const { s, box, run } = world();
  box(150, 220, 150, 259, E.GLASS); box(170, 220, 170, 259, E.GLASS);
  box(151, 240, 169, 259, E.WATER); box(158, 236, 162, 238, E.CONCRETE);
  run(120);
  let low = 0, n = 0; s.cells.forEach((c, i) => { if (c === E.CONCRETE || (c === E.STONE && i % E.W > 150 && i % E.W < 170 && ((i / E.W) | 0) < FLOOR)) { low += (i / E.W) | 0; n++; } });
  assert.ok(n > 0 && low / n > 250, `it sank to the bottom (mean row ${(low / Math.max(1, n)).toFixed(0)})`);
});

test('concrete pours into a mould and sets to stone, curing from the walls in', () => {
  const { s, box, count, run } = world();
  box(200, 240, 200, 259, E.BRICK); box(230, 240, 230, 259, E.BRICK);
  box(201, 245, 229, 259, E.CONCRETE);
  const total = count(E.CONCRETE);
  run(60 * 3);
  let edge = 0, mid = 0;
  for (let y = 250; y < FLOOR; y++) { if (s.cells[y * E.W + 201] === E.STONE) edge++; if (s.cells[y * E.W + 215] === E.STONE) mid++; }
  assert.ok(edge > mid, `the edge by the brick cures first (${edge} vs ${mid})`);
  run(60 * 60);
  assert.ok(count(E.CONCRETE) < total * 0.05, `a minute later it is stone (${count(E.CONCRETE)} of ${total} still wet)`);
});

// ---------- c-4 ----------
test('c-4: nitro kneaded into wax; heat alone will not wake it', () => {
  const a = world();
  a.box(100, 255, 105, 259, E.NITRO); a.box(106, 255, 107, 259, E.WAX);
  a.run(30);
  assert.ok(a.count(E.C4) > 0, 'c-4 formed');
  const { box, count, w, s } = world();
  box(100, 250, 110, 259, E.C4);
  for (let t = 0; t < 120; t++) w.advanceTicks(1, [{ tick: w.captureState().tickIndex + 1, sequence: 0, op: { t: 'heat', x: 105, y: 255, r: 3 } }]);
  assert.equal(count(E.C4), 110, 'the heat wand does not set it off');
});

test('c-4 goes off at a flame, every block beside it answers, and it out-blasts tnt', () => {
  const crater = (m) => {
    const { s, box, count, run } = world();
    box(100, 200, 380, 259, E.STONE); box(238, 228, 242, 232, m); box(300, 228, 304, 232, m);
    box(243, 230, 299, 230, m);
    s.setc(240, 227, E.FIRE, 0);
    const before = count(E.STONE), events = [];
    for (let t = 0; t < 60; t++) events.push(...run(1));
    return { gone: before - count(E.STONE), blasts: events.filter(e => e.t === 'blast').length, left: count(m) };
  };
  const c4 = crater(E.C4), tnt = crater(E.TNT);
  assert.equal(c4.left, 0, 'the whole charge went off, along the line to the far block');
  assert.ok(c4.gone > tnt.gone * 1.5, `c-4 clears ${c4.gone} grains, tnt ${tnt.gone}`);
});

// ---------- fuse ----------
test('fuse: plant beside powder becomes fuse', () => {
  const { box, count, run } = world();
  box(100, 255, 120, 259, E.PLANT); box(121, 255, 122, 259, E.POWDER);
  run(120);
  assert.ok(count(E.FUSE) > 0, 'fuse formed');
});

test('a lit fuse burns at a steady walk and sets off the cask at the end', () => {
  const { s, box, count, run } = world();
  box(100, 230, 160, 230, E.FUSE); box(161, 228, 164, 232, E.TNT);
  s.setc(99, 230, E.FIRE, 0);
  let half = -1, boom = -1;
  for (let t = 0; t < 60 * 20; t++) {
    const ev = run(1);
    if (half < 0 && s.cells[230 * E.W + 130] !== E.FUSE) half = t;
    if (boom < 0 && ev.some(e => e.t === 'blast')) boom = t;
  }
  assert.ok(half > 120 && half < 600, `thirty grains take a few seconds (${half} ticks)`);
  assert.ok(boom > half, `the cask goes off when the flame arrives (${boom})`);
  assert.equal(count(E.FUSE), 0);
  const b = world();
  b.box(100, 240, 160, 240, E.FUSE);
  b.run(600);
  assert.equal(b.count(E.FUSE), 61, 'an unlit fuse just waits');
});

// ---------- cryo ----------
test('cryo: aether against ice falls as cryo; cryo freezes water and quenches lava', () => {
  const a = world();
  a.box(100, 250, 110, 252, E.ICE); a.box(100, 253, 110, 253, E.AETHER);
  a.run(3);
  assert.ok(a.count(E.CRYO) > 0, 'cryo formed');
  const { box, count, run } = world();
  box(100, 240, 100, 259, E.GLASS); box(140, 240, 140, 259, E.GLASS);
  box(101, 250, 139, 259, E.WATER); box(115, 245, 125, 246, E.CRYO);
  run(120);
  assert.ok(count(E.ICE) > 25, `the pond skins over where it lands (${count(E.ICE)} ice)`);
  const b = world();
  b.box(200, 255, 220, 259, E.LAVA); b.box(205, 250, 215, 252, E.CRYO);
  b.run(60);
  assert.ok(b.count(E.OBSIDIAN) > 5, 'lava quenches to obsidian');
});

test('cryo snuffs burning napalm and fire, spending itself as snow', () => {
  const { s, box, count, run } = world();
  box(100, 255, 129, 259, E.NAPALM); s.setc(115, 254, E.FIRE, 0);
  run(60);
  box(100, 248, 129, 252, E.CRYO);
  run(240);
  assert.ok(count(E.NAPALM) > 60, `the cold saved most of the pool (${count(E.NAPALM)} of 150)`);
  assert.ok(count(E.CRYO) < 150, 'and spent itself doing it (cryo only ever turns to snow)');
});

// ---------- font ----------
test('the font learns the first thing that touches it and pours it forever', () => {
  const { s, count, run, at } = world();
  s.setc(240, 100, E.FONT, 0);
  run(5);
  assert.equal(count(E.FONT), 1);
  s.setc(240, 99, E.SAND, 0);
  run(2);
  assert.equal(s.shades[100 * E.W + 240], E.SAND, 'it learned sand');
  run(300);
  assert.ok(count(E.SAND) > 200, `and pours it (${count(E.SAND)})`);
  assert.equal(at(240, 100), E.FONT, 'the font stays');
});

test('the font will not learn walls or doors, and gives gases upward and fire as a torch', () => {
  const a = world();
  a.s.setc(240, 259, E.FONT, 0);
  a.run(60);
  assert.equal(a.s.shades[259 * E.W + 240], 0, 'resting on stone it learns nothing');
  assert.equal(a.count(E.FONT), 1);
  const b = world();
  b.w.applyOperation({ t: 'font', x: 240, y: 200, m: E.STEAM });
  b.run(120);
  let below = 0, above = 0; b.s.cells.forEach((c, i) => { if (c === E.STEAM) { if (((i / E.W) | 0) < 200) above++; else below++; } });
  assert.ok(above > 50 && above > below * 4, `steam goes up (${above} above, ${below} below)`);
  const c = world();
  c.w.applyOperation({ t: 'font', x: 240, y: 259, m: E.FIRE });
  c.run(600);
  assert.ok(c.count(E.FIRE) >= 1, 'a fire font keeps a flame: a torch');
  assert.equal(c.at(240, 259), E.FONT);
  for (const m of [E.STONE, E.VOID, E.RIFT, E.FONT, E.AIR]) assert.equal(E.fontLearns(m), false, E.NAMES[m]);
  for (const m of [E.SAND, E.WATER, E.FIRE, E.STEAM, E.MITE, E.NAPALM]) assert.equal(E.fontLearns(m), true, E.NAMES[m]);
});

test('aether at a pearl becomes a font; the font op validates and survives a checkpoint', () => {
  const a = world();
  a.s.setc(240, 259, E.PEARL, 0); a.s.setc(240, 258, E.AETHER, 0);
  a.run(2);
  assert.ok(a.count(E.FONT) === 1, 'the pearl became a font');
  assert.deepEqual(validateOperations([{ t: 'font', x: 10, y: 20, m: E.WATER }]), [{ t: 'font', x: 10, y: 20, m: E.WATER }]);
  assert.throws(() => validateOperations([{ t: 'font', x: 10, y: 20, m: 64 }]));
  assert.throws(() => validateOperations([{ t: 'font', x: 10, y: 20 }]));
  const e = E.createEngine({ seed: 9, scene: 'empty', ambientEmbers: false, weather: false });
  e.advanceTicks(1, [{ tick: 1, sequence: 0, op: { t: 'font', x: 100, y: 50, m: E.WATER } }]);
  e.inspect().setc(300, 50, E.FONT, E.C4);
  const cp = e.checkpoint();
  assert.doesNotThrow(() => validateCheckpoint(cp));
  const f = E.createEngine({ seed: 9, scene: 'empty', ambientEmbers: false, weather: false });
  f.restore(cp);
  assert.equal(f.inspect().cells[50 * E.W + 100], E.FONT);
  e.advanceTicks(120); f.advanceTicks(120);
  assert.deepEqual(e.inspect().cells, f.inspect().cells, 'a restored font pours exactly as the original');
});

test('the page offers a tap tool that sends the font op', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
  assert.match(html, /\['tap', '[^']+'\]/);
  assert.match(html, /t: 'font', x: [^,]+, y: [^,]+, m: /);
});
