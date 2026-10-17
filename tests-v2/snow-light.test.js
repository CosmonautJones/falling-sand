import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../public/v2/alembic-engine-v2.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const frag = html.slice(html.indexOf('const FRAG = `'), html.indexOf('`;', html.indexOf('const FRAG = `')));

function world(seed = 3) {
  const e = E.createEngine({ seed, scene: 'empty', ambientEmbers: false, weather: false }), w = e.inspect();
  for (let x = 0; x < 480; x++) for (let y = 260; y < 270; y++) w.setc(x, y, E.STONE, 0);
  const box = (x0, y0, x1, y1, m) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.setc(x, y, m, 0); };
  const count = m => w.cells.reduce((n, c) => n + (c === m), 0);
  const extent = m => { let minX = 999, maxX = -1, minY = 999; w.cells.forEach((c, i) => { if (c === m) { const x = i % 480, y = (i / 480) | 0; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); } }); return { w: maxX - minX + 1, h: 260 - minY }; };
  return { e, w, box, count, extent };
}

// ---------- steam ----------
test('steam pooled against plants in a sealed cave no longer sets them alight', () => {
  for (const seed of [1, 3, 4, 7]) {
    const { e, w, box, count } = world(seed);
    box(200, 200, 260, 240, E.STONE); box(204, 204, 256, 236, E.AIR);
    box(204, 230, 256, 236, E.MUD); box(204, 228, 256, 229, E.WATER); box(206, 205, 254, 207, E.PLANT);
    for (let k = 0; k < 300; k++) w.setc(206 + (k % 48), 226 - ((k / 48) | 0), E.STEAM, 0);
    let fire = 0;
    for (let t = 0; t < 600; t++) { e.advanceTicks(1); fire = Math.max(fire, count(E.FIRE)); }
    assert.equal(fire, 0, `seed ${seed}: a steamy cave stays unlit`);
  }
});

test('flames still burn a thicket, and the heat wand still lights fuel', () => {
  const a = world();
  a.box(100, 250, 139, 259, E.PLANT); a.w.setc(120, 249, E.FIRE, 0);
  a.e.advanceTicks(300);
  assert.ok(a.count(E.PLANT) < 40, `the thicket burns (${a.count(E.PLANT)} of 400 left)`);
  const b = world();
  b.box(100, 250, 110, 259, E.WOOD);
  for (let t = 0; t < 40; t++) b.e.advanceTicks(1, [{ tick: b.e.captureState().tickIndex + 1, sequence: 0, op: { t: 'heat', x: 105, y: 255, r: 4 } }]);
  b.e.advanceTicks(120);
  assert.ok(b.count(E.FIRE) + b.count(E.EMBER) + b.count(E.ASH) + b.count(E.CHARCOAL) > 0, 'heated wood catches');
});

// ---------- snow ----------
test('a snow column slumps into a mound instead of standing as a tower', () => {
  const { e, box, extent } = world();
  box(238, 220, 242, 259, E.SNOW);
  e.advanceTicks(60 * 20);
  const s = extent(E.SNOW);
  assert.ok(s.w > 20, `the column spreads (${s.w} wide)`);
  assert.ok(s.h < 15, `and is no longer a tower (${s.h} tall)`);
});

test('snow falls slowly and flutters, far slower than sand', () => {
  const fall = m => {
    const { e, w } = world(); w.setc(100, 20, m, 0);
    for (let t = 1; t < 3000; t++) { e.advanceTicks(1); for (let x = 80; x <= 120; x++) if (w.cells[259 * 480 + x] === m) return { t, x }; }
    return { t: 3000, x: 100 };
  };
  const snow = fall(E.SNOW), sand = fall(E.SAND);
  assert.ok(snow.t > sand.t * 4, `snow takes ${snow.t} ticks, sand ${sand.t}`);
  assert.ok(snow.x !== 100 || fall(E.SNOW).x !== 100, 'flakes drift sideways on the way down');
  assert.ok(E.SNOWFALL.maxFall < 1 && E.SNOWFALL.hang > 0 && E.SNOWFALL.drift > 0);
});

test('deep snow packs to ice from the bottom; a thin layer does not', () => {
  const deep = world();
  deep.box(150, 200, 199, 259, E.SNOW);
  deep.e.advanceTicks(60 * 60);
  assert.ok(deep.count(E.ICE) > 100, `a deep bank grows ice (${deep.count(E.ICE)})`);
  let iceY = 0, n = 0; deep.w.cells.forEach((c, i) => { if (c === E.ICE) { iceY += (i / 480) | 0; n++; } });
  assert.ok(iceY / n > 240, 'the ice forms at the bottom of the bank');
  const thin = world();
  thin.box(150, 252, 199, 259, E.SNOW);
  thin.e.advanceTicks(60 * 60);
  assert.equal(thin.count(E.ICE), 0, 'a layer eight deep (seven above the bottom grain) stays snow');
});

test('a sliding snow grain pulls the snow above it along', () => {
  const { e, w, box } = world();
  box(100, 230, 160, 259, E.STONE); box(161, 259, 200, 259, E.STONE);
  box(140, 200, 160, 229, E.SNOW);
  box(161, 200, 161, 258, E.STONE);
  w.setc(161, 200, E.AIR, 0); for (let y = 201; y < 259; y++) w.setc(161, y, E.AIR, 0);
  e.advanceTicks(60 * 15);
  let right = 0; w.cells.forEach((c, i) => { if (c === E.SNOW && i % 480 > 161) right++; });
  assert.ok(right > 150, `the bank avalanches off its ledge (${right} grains went over)`);
});

test('thrown and blasted snow still flies; only slow-falling flakes flutter', () => {
  const rise = (m, vx, vy) => {
    const { e, w } = world(); w.setc(240, 200, m, 0);
    const s = e.inspect(); s.VX[200 * 480 + 240] = vx; s.VY[200 * 480 + 240] = vy;
    let top = 200, far = 0;
    for (let t = 0; t < 40; t++) { e.advanceTicks(1); w.cells.forEach((c, i) => { if (c === m) { top = Math.min(top, (i / 480) | 0); far = Math.max(far, Math.abs(i % 480 - 240)); } }); }
    return { up: 200 - top, far };
  };
  const snowUp = rise(E.SNOW, 0, -5), sandUp = rise(E.SAND, 0, -5);
  assert.ok(snowUp.up > sandUp.up * 0.7, `snow thrown upward rises ${snowUp.up}, sand ${sandUp.up}`);
  const snowSide = rise(E.SNOW, 4, 0), sandSide = rise(E.SAND, 4, 0);
  assert.ok(snowSide.far > sandSide.far * 0.6, `snow thrown sideways travels ${snowSide.far}, sand ${sandSide.far}`);
  const bank = m => {
    const { e, w, box } = world(); box(200, 240, 280, 259, m);
    w.detonate(240, 241, 8);
    let top = 260; for (let t = 0; t < 60; t++) { e.advanceTicks(1); w.cells.forEach((c, i) => { if (c === m) top = Math.min(top, (i / 480) | 0); }); }
    return 240 - top;
  };
  const sb = bank(E.SNOW), ab = bank(E.SAND);
  assert.ok(sb > ab * 0.6, `a blast throws snow ${sb} rows high, sand ${ab}`);
});

// ---------- the look ----------
test('the shader shades snow and ice by their real ids, and glow lights caves', () => {
  assert.equal(E.SNOW, 43); assert.equal(E.ICE, 12);
  assert.match(frag, /if \(abs\(id - 43\.0\) < 0\.5\) \{/);
  assert.match(frag, /\} else if \(abs\(id - 12\.0\) < 0\.5\) \{/);
  assert.match(frag, /float encl = textureLod\(uFx, st, 4\.5\)\.r;/);
  assert.match(frag, /vec3 glowL = min\(lightF \* \(1\.5 \+ 1\.2 \* shut\)/, 'glow is capped and scaled by the light setting once');
  assert.match(frag, /col \*= 1\.0 - cave \* 0\.5;/, 'open air inside caves is shadowed');
  assert.ok(!/col = c\.rgb \* \(1\.0 - cave/.test(frag), 'solid ground is not shadowed (no halo around caves)');
});
