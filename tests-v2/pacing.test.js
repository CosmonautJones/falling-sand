import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { queueToast } from '../public/v2/toasts.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const find = name => ({ kind: 'find', names: [name], label: 'TRANSMUTED · ' + name.toUpperCase(), text: name + ' text' });

test('a burst of finds becomes one toast', () => {
  let q = [];
  for (const n of ['steam', 'ember', 'ash', 'smoke']) q = queueToast(q, find(n));
  assert.equal(q.length, 1);
  assert.equal(q[0].label, 'TRANSMUTED · STEAM, EMBER +2');
  assert.equal(q[0].text, 'smoke text', 'the newest whisper wins');
});

test('rites never merge, and a rite splits a run of finds', () => {
  let q = queueToast([], find('steam'));
  q = queueToast(q, { kind: 'rite', label: 'RITE · X', text: 't' });
  q = queueToast(q, find('ash'));
  assert.equal(q.length, 3);
  assert.equal(q[2].label, 'TRANSMUTED · ASH');
});

test('rites for making things fire on the transmutation itself, not only on a first-time page', () => {
  assert.match(html, /if \(e\.t === 'tx'\) this\.riteFor\(e\.m\);/);
  assert.match(html, /riteFor\(m\) \{/);
});

test('the opening chain does not hand out the cask rites; the next blast does', () => {
  assert.match(html, /armOpening\(\) \{ this\.openingPending = true; this\.openingUntil = performance\.now\(\) \+ 60000; \}/);
  assert.match(html, /if \(this\.openingPending && performance\.now\(\) < this\.openingUntil\) opening = true;\s*else \{ this\.unlock\('sneeze'\)/);
  assert.match(html, /if \(opening\) this\.openingPending = false;/);
  assert.match(html, /onClear: \(\) => \{ this\.openingPending = false;/);
});

test('Alchemist counts transmuted pages, not the starting reagents', () => {
  assert.match(html, /M\.TRANSMUTED\.filter\(id => this\.known\.has\(id\)\)\.length >= 20\) this\.unlock\('alchemist'\)/);
});

test('phones get a slim, quicker toast', () => {
  assert.match(html, /\.toast-text\{[^}]*white-space:nowrap/);
  assert.match(html, /this\.phone \? 1600 : 2200/);
  assert.match(html, /\.toast-label\{[^}]*white-space:nowrap/);
  assert.match(html, /@media\(orientation:portrait\) and \(max-width:700px\)\{\.toast-text\{display:none\}\}/, 'portrait header already shows the whisper');
});
