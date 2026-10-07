import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../public/v2/alembic-engine-v2.js';
import { AMBITIONS, checkAmbitions } from '../public/v2/ambitions.js';
import { addToGallery, GALLERY_MAX } from '../public/v2/gallery.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const counts = (pairs) => { const c = new Array(E.COUNT).fill(0); for (const [m, n] of pairs) c[m] = n; return c; };

test('ambitions are named, described, and each is reachable from census counts', () => {
  assert.ok(AMBITIONS.length >= 6);
  const keys = new Set();
  for (const a of AMBITIONS) {
    assert.ok(a.key && a.name && a.desc, 'named and described');
    assert.ok(!keys.has(a.key)); keys.add(a.key);
    assert.equal(typeof a.done, 'function');
  }
});

test('checkAmbitions reports only newly met ambitions', () => {
  const none = checkAmbitions(counts([]), E, new Set());
  assert.deepEqual(none, []);
  const reef = AMBITIONS.find(a => a.key === 'reef');
  const met = checkAmbitions(counts([[E.CORAL, 500]]), E, new Set());
  assert.ok(met.includes('reef'));
  assert.deepEqual(checkAmbitions(counts([[E.CORAL, 500]]), E, new Set(['reef'])).filter(k => k === 'reef'), []);
  assert.ok(reef.desc.length > 8);
});

test('gallery keeps the newest twelve distinct links', () => {
  let g = [];
  for (let i = 0; i < 15; i++) g = addToGallery(g, { url: `#flask=z${i}`, thumb: 'data:', t: i });
  assert.equal(g.length, GALLERY_MAX);
  assert.equal(GALLERY_MAX, 12);
  assert.equal(g[0].url, '#flask=z14', 'newest first');
  g = addToGallery(g, { url: '#flask=z5', thumb: 'data:', t: 99 });
  assert.equal(g.filter(e => e.url === '#flask=z5').length, 1, 'no duplicates');
  assert.equal(g[0].url, '#flask=z5');
  assert.deepEqual(addToGallery(g, { url: 'javascript:alert(1)', thumb: '', t: 1 }), g, 'only flask links');
});

test('the daily vessel is the same all day, different the next, and carries gifts', () => {
  const day = d => { const w = E.createWorld({ seed: 1, scene: 'empty' }); w.applyOperation({ t: 'wipe', mode: 'daily', day: d }); w.advanceTicks(80); return w; };
  const a = day(20261007).captureState().cells, b = day(20261007).captureState().cells, c = day(20261008).captureState().cells;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  const gifts = [E.CLOUD, E.SNOW, E.MUD, E.AETHER, E.FIREFLY, E.MOSS, E.CORAL, E.BRINE, E.FUNGUS];
  assert.ok(gifts.some(m => a.includes(m)), 'a gift for a new material');
  assert.ok(a.includes(E.MINNOW) && a.includes(E.STONE), 'still the vessel underneath');
});

test('UI: an ambitions tab, a daily vessel button, and a gallery of links', () => {
  assert.match(html, /ambitions\.js/);
  assert.match(html, /\['ambitions', 'AMBITIONS'\]/);
  assert.match(html, /mode: 'daily', day:/);
  assert.match(html, /gallery\.js/);
  assert.match(html, /GKEY = 'alembic-gallery-v2'/);
  assert.match(html, /<sc-for list="\{\{ gallery \}\}"/);
});
