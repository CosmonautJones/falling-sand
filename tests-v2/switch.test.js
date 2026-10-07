import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../public/v2/alembic-engine-v2.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const markup = html.slice(0, html.indexOf('<script type="text/x-dc"'));
const options = markup.slice(markup.indexOf('data-sheet="options"'));

test('version switch: v1 is one tap away on phones and desktop, v2 is marked current', () => {
  assert.match(options, /<a [^>]*href="\.\.\/"[^>]*>v1<\/a>/);
  assert.match(options, /aria-current="page"[^>]*>v2</);
  assert.match(markup.slice(0, markup.indexOf('</header>')), /<a [^>]*href="\.\.\/"[^>]*>v1<\/a>/);
});

test('start over: two taps erase every Alembic v2 key and reload to a first run', () => {
  assert.match(options, /onClick="\{\{ onStartOver \}\}"/);
  const keys = html.match(/const DKEY[^\n]*/)[0];
  const names = [...keys.matchAll(/'(alembic-[a-z-]+-v2)'/g)].map(m => m[1]);
  assert.ok(names.length >= 8);
  assert.match(html, /const SAVE_KEYS = \[DKEY, RKEY, FKEY, SKEY, TKEY, PKEY, AKEY, GKEY\];/);
  assert.match(html, /startOver\(\) \{[^}]*if \(!this\.state\.wipeArmed\)/);
  assert.match(html, /for \(const k of SAVE_KEYS\) localStorage\.removeItem\(k\)/);
  assert.match(html, /location\.replace\(location\.pathname\)/);
});

test('the opening is a bigger moment: a cask cluster goes off in a chain', () => {
  const world = E.createWorld({ seed: 0xa341316c, scene: 'vessel' });
  let blasts = 0;
  for (let t = 1; t <= 1800; t++) blasts += world.advanceTicks(1).filter(e => e.t === 'blast').length;
  assert.ok(blasts >= 6, `opening blasts: ${blasts}`);
});

test('phones get touch instructions under the title, not mouse ones', () => {
  assert.match(html, /this\.coarse \? 'Drag to pour\. Hold still to name a grain\. Pinch to zoom\.' : 'Hold to pour\. Right-click/);
});

test('the camera leans toward a blast rather than the centre (and not in reduced motion)', () => {
  assert.match(html, /this\.punchAt = \{ x: e\.x \/ M\.W, y: e\.y \/ M\.H \}/);
  assert.match(html, /const ax = this\.punchAt \? this\.punchAt\.x : 0\.5/);
});
