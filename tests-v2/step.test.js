import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as E from '../public/v2/alembic-engine-v2.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const buffers = () => Array.from({ length: 3 }, () => new Uint8Array(E.N * 4));
const fingerprint = state => createHash('sha256').update(JSON.stringify(state, (_, value) =>
  ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') : value
)).digest('hex');
const pour = { t: 'p', x: 120, y: 40, r: 4, m: E.SAND };

test('a paused step commits exactly that many fixed ticks', () => {
  const a = E.createEngine({ seed: 7 }), b = E.createEngine({ seed: 7 });
  a.tick({ paused: true, step: 5, dt: 900, speed: 2, ops: [pour] }, ...buffers());
  b.tick({ dt: 0, speed: 1, ops: [pour] }, ...buffers());
  b.advanceTicks(5);
  const sa = a.captureState(), sb = b.captureState();
  assert.equal(sa.tickIndex, 5, 'dt and speed are ignored while stepping');
  assert.equal(fingerprint(sa), fingerprint(sb), 'stepping matches running the same ticks');
});

test('steps are capped and ignored while running', () => {
  const a = E.createEngine({ seed: 3 });
  a.tick({ paused: true, step: 10000, dt: 0, speed: 1 }, ...buffers());
  assert.equal(a.captureState().tickIndex, E.MAX_STEP);
  const b = E.createEngine({ seed: 3 });
  b.tick({ step: 50, dt: 1000 / 60, speed: 1 }, ...buffers());
  assert.equal(b.captureState().tickIndex, 1, 'a running frame uses the clock, not step');
  const c = E.createEngine({ seed: 3 });
  c.tick({ paused: true, step: -4, dt: 0, speed: 1 }, ...buffers());
  c.tick({ paused: true, step: NaN, dt: 0, speed: 1 }, ...buffers());
  assert.equal(c.captureState().tickIndex, 0, 'bad step values do nothing');
});

test('quarter speed is offered and the chosen speed is remembered', () => {
  assert.match(html, /const CLOCKS = \[0\.25, 0\.5, 1, 2\]/);
  assert.match(html, /CKEY = 'alembic-speed-v2'/);
  assert.match(html, /if \(CLOCKS\.includes\(c\)\) speed = c;/, 'only a known speed is restored');
  assert.match(html, /setSpeed\(v\) \{ if \(!CLOCKS\.includes\(v\)\) return; try \{ localStorage\.setItem\(CKEY/);
});

test('step is wired to a key, a button on desktop and in the phone sheet', () => {
  assert.match(html, /step: this\.state\.paused \? this\.stepQ : 0/);
  assert.match(html, /if \(e\.key === '\.' \|\| e\.key === '>'\) \{ e\.preventDefault\(\); this\.stepTicks\(e\.key === '>' \? 10 : 1\)/);
  assert.equal((html.match(/onClick="\{\{ onStep \}\}"/g) || []).length, 2);
  assert.match(html, /stepTicks\(n\) \{[^}]*if \(!this\.state\.paused\) this\.setState\(\{ paused: true \}\)/, 'stepping pauses first');
});
