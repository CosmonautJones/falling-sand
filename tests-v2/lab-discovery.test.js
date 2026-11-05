import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/engine/world.js';
import { createProgress, reveal, canPour, setAccess, serializeProgress, readProgress, saveProgress, JOURNAL_KEY, LEGACY_KEY, MILESTONES, hintFor, pageFor } from '../public/v2/lab/discovery.js';

test('discovery begins with V2 starters and carries valid legacy knowledge without opening the workshop', () => {
  const state = createProgress(null, [E.GLASS, E.AIR, -1, E.COUNT, '24', 1.5]);
  assert.equal(state.mode, 'discovery');
  assert.equal(state.known.size, 14);
  assert.ok(state.inherited.has(E.GLASS));
  assert.ok(canPour(state, E.SAND));
  assert.equal(canPour(state, E.AETHER), false);
  assert.equal(canPour(state, E.AIR), false);
  assert.equal(state.next.goal, E.BRINE);
});

test('a real creation reveals once and awards clearly separate, reachable research supplies', () => {
  const state = createProgress();
  const glass = { m: E.GLASS, x: 10, y: 10 };
  assert.deepEqual(reveal(state, [glass, glass]).found, [glass]);
  assert.equal(reveal(state, [glass]).changed, false);
  const result = reveal(state, [{ m: E.BRICK, x: 11, y: 10 }]);
  assert.equal(result.awards[0].id, 'kiln');
  for (const m of [E.COPPER, E.STEEL, E.TUNGSTEN]) {
    assert.ok(state.known.has(m)); assert.ok(state.supplied.has(m)); assert.equal(state.made.has(m), false);
  }
  assert.equal(state.made.has(E.BRICK), true);
  assert.equal(result.found.length, 1, 'supplies are not announced as transmutations');
});

test('all inert additions and seeded-only minnows have an achievable supply path', () => {
  const state = createProgress();
  const goals = [...new Set(MILESTONES.flatMap(m => m.requires))];
  assert.ok(goals.every(m => m > 0 && m < E.COPPER && m !== E.MINNOW));
  reveal(state, goals.map(m => ({ m, x: 1, y: 1 })));
  for (const m of [E.COPPER, E.STEEL, E.TUNGSTEN, E.HELIUM, E.AEROGEL, E.LIQUID_NITROGEN, E.FERROFLUID, E.MAGNET, E.MINNOW]) assert.ok(canPour(state, m));
  assert.equal(canPour(state, E.NITROGEN), false, 'nitrogen is made by boiling the earned liquid');
  assert.match(hintFor(E.MINNOW), /^A research supply/, 'the Lab clue explains the specimen path rather than V2’s seeded trough');
  for (let m = 1; m < E.COUNT; m++) assert.ok(hintFor(m).length > 4, `page ${m} has a clue`);
});

test('workshop grants access without filling pages and safely returns to discovery', () => {
  const state = createProgress(), before = serializeProgress(state);
  setAccess(state, 'workshop');
  assert.ok(canPour(state, E.AZOTH));
  assert.deepEqual([...state.known], before.known);
  assert.equal(state.made.size, 0);
  setAccess(state, 'discovery');
  assert.equal(canPour(state, E.AZOTH), false);
  assert.throws(() => setAccess(state, 'anything'));
});

test('Lab field notes preserve V2 whispers without promising unavailable secrets or fixed bodies', () => {
  for (const m of [E.MERCURY, E.GOLD, E.AETHER, E.VOID, E.CLOUD, E.FONT]) {
    assert.equal(pageFor(m).w, E.PAGES[m].w);
    assert.doesNotMatch(pageFor(m).l, /Konami|typed into|seven strikes|word tempest|tap tool/i);
  }
  assert.match(pageFor(E.STONE).l, /gravity/);
  assert.match(pageFor(E.STEEL).l, /disconnected ones fall/);
});

test('reload keeps earned pages, supply provenance and selected access mode', () => {
  const state = createProgress();
  reveal(state, [{ m: E.STEAM }, { m: E.OBSIDIAN }]);
  setAccess(state, 'workshop');
  const restored = createProgress(JSON.parse(JSON.stringify(serializeProgress(state))));
  assert.equal(restored.mode, 'workshop');
  assert.ok(restored.made.has(E.STEAM));
  assert.ok(restored.supplied.has(E.LIQUID_NITROGEN));
  assert.ok(restored.completed.has('thermal'));
  assert.equal(reveal(restored, [{ m: E.STEAM }]).found.length, 0);
});

test('malformed storage is bounded, invalid IDs are ignored and unavailable storage does not stop play', () => {
  const values = new Map([[JOURNAL_KEY, '{broken'], [LEGACY_KEY, JSON.stringify([E.GLASS])]]);
  const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  const { state, unavailable } = readProgress(storage);
  assert.equal(unavailable, true);
  assert.ok(state.known.has(E.GLASS));
  assert.equal(saveProgress(storage, state), true);
  assert.deepEqual(JSON.parse(values.get(LEGACY_KEY)), [E.GLASS], 'V2 progress is never rewritten');
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(readProgress(blocked).state.known.size, 13);
  assert.equal(saveProgress(blocked, state), false);
  assert.equal(createProgress({ version: 1, known: [E.GOLD, '24', 999] }).known.has(E.GOLD), false, 'unrecognized formats do not import');
});

test('saving from two tabs merges discoveries instead of overwriting the other journal', () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  const a = readProgress(storage).state, b = readProgress(storage).state;
  reveal(a, [{ m: E.BRINE }]); reveal(b, [{ m: E.GLASS }]);
  assert.equal(saveProgress(storage, a), true);
  assert.equal(saveProgress(storage, b), true);
  const restored = readProgress(storage).state;
  assert.ok(restored.made.has(E.BRINE)); assert.ok(restored.made.has(E.GLASS));
  assert.equal(values.has(LEGACY_KEY), false);
});
