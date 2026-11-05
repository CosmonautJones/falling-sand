import test from 'node:test';
import assert from 'node:assert/strict';
import { createFieldJournal } from '../public/v3/journal.js';
import { seasonAt } from '../public/v3/climate.js';

const stats = (tick, fields = {}) => ({
  season: seasonAt(tick), soilWater: 40, reeds: 0, burnedPatches: 0, flowers: 0, ...fields,
});

test('the dry-season journal counts surviving roots, even when a replacement restores total plant count', () => {
  const journal = createFieldJournal();
  const reed = { kind: 'reed' }, clover = { kind: 'clover' };
  journal.observe(stats(0), []);
  journal.observe(stats(720), [reed, clover]);
  journal.observe(stats(1440, { soilWater: 12 }), [reed, { kind: 'clover' }]);
  const entry = journal.entries.find(({ title }) => title === 'After the dry spell');
  assert.match(entry.text, /1 of 2 plants present at the start of Dry are still rooted/);
  assert.match(entry.text, /40 → 12/);
});

test('species firsts appear once and a midseason import reports a partial observation', () => {
  const journal = createFieldJournal(), reed = { kind: 'reed' };
  journal.observe(stats(900, { reeds: 1 }), [reed]);
  assert.equal(journal.observe(stats(930, { reeds: 1 }), [reed]), false);
  journal.observe(stats(1440, { reeds: 1 }), [reed]);
  assert.equal(journal.entries.filter(({ title }) => title === 'First reeds').length, 1);
  assert.match(journal.entries.find(({ title }) => title === 'After the dry spell').text, /when this observation began/);
});
