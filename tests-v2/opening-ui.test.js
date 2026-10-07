import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../public/v2/alembic-engine-v2.js';
import { pickNudge, NUDGES } from '../public/v2/opening.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const markup = html.slice(0, html.indexOf('<script type="text/x-dc"'));

test('every nudge names a transmuted goal and a starter reagent to try', () => {
  assert.ok(NUDGES.length >= 6);
  for (const n of NUDGES) {
    assert.ok(E.TRANSMUTED.includes(E[n.goal]), `${n.goal} is transmuted`);
    assert.ok(E.STARTER.includes(E[n.brush]), `${n.brush} is a starter`);
    assert.match(n.text, /^[A-Z].*\.$/, 'a short imperative sentence');
  }
});

test('the nudge points at the first goal not yet made', () => {
  const known = new Set([...E.STARTER, E.STEAM, E.ASH]);
  const first = pickNudge(known, E);
  assert.equal(first.goal, E[NUDGES[0].goal]);
  assert.equal(first.brush, E[NUDGES[0].brush]);
  known.add(E[NUDGES[0].goal]);
  assert.equal(pickNudge(known, E).goal, E[NUDGES[1].goal]);
});

test('no nudge once every goal is made', () => {
  const known = new Set([...E.STARTER, ...E.TRANSMUTED]);
  assert.equal(pickNudge(known, E), null);
});

test('the first blast (or 25 s of calm) nudges exactly once per session', () => {
  assert.match(html, /opening\.js/);
  assert.match(html, /case 'blast': \{[^\n]*this\.queueNudge\(/);
  assert.match(html, /this\.nudgeT = setTimeout\(\(\) => this\.nudge\(\), 25000\)/);
  assert.match(html, /nudge\(\) \{[^\n]*if \(this\.nudged\) return;/);
});

test('a nudge suggests the element without taking the brush away', () => {
  assert.match(html, /suggest: n\.brush/);
  assert.match(markup, /data-phone="element"[^>]*data-suggest="\{\{ suggesting \}\}"/);
  assert.match(html, /\[data-suggest="true"\][^{]*\{[^}]*animation/);
  assert.match(html, /prefers-reduced-motion:reduce\)\{[^}]*\[data-suggest="true"\][^}]*animation:none/);
});

test('what the seeded vessel already holds is stained quietly, without toasts or rites', () => {
  const onSeen = html.slice(html.indexOf('onSeen(seen) {'), html.indexOf('revealMany(list, note) {'));
  assert.match(onSeen, /if \(!this\.seenOnce\) \{ this\.seenOnce = true; this\.stainQuietly\(fresh\); \}/);
  const quiet = onSeen.slice(onSeen.indexOf('stainQuietly(list) {'));
  assert.doesNotMatch(quiet, /toast|chime|unlock/);
});

test('a first-run pour hint shows until the first pour, then never again', () => {
  assert.match(markup, /data-pour-hint/);
  assert.match(html, /PKEY = 'alembic-poured-v2'/);
  assert.match(html, /localStorage\.setItem\(PKEY, '1'\)/);
});
