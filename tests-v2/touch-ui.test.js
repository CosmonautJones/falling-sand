import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';
import {
  IDLE_MS, HOLD_MS, arcSlots, createIdleChrome, familyOf, groupKnown, nearestSlot, nextSnap,
  pickerIds, placeSlot, recentAround, rememberRecent,
} from '../public/v2/touch-ui.js';

test('every material except nothing lands in exactly one family', () => {
  const ids = [];
  for (let id = 0; id < E.COUNT; id++) ids.push(id);
  const groups = groupKnown(ids, E.NAMES, '');
  const flat = groups.flatMap(group => group.ids);
  assert.equal(flat.length, E.COUNT);
  assert.equal(new Set(flat).size, flat.length);
  assert.equal(familyOf(E.SAND), 'powders');
  assert.equal(familyOf(E.WATER), 'liquids');
  assert.equal(familyOf(E.PLANT), 'life');
  assert.equal(familyOf(E.FIRE), 'fire');
  assert.equal(familyOf(E.STONE), 'stone');
  assert.equal(familyOf(E.STEAM), 'gases');
  assert.equal(familyOf(E.AIR), 'gases');
  assert.deepEqual(groups.map(group => group.label), ['Powders', 'Liquids', 'Life', 'Fire', 'Stone', 'Gases']);
});

test('search keeps a family only when a known name matches', () => {
  const groups = groupKnown([E.SAND, E.WATER, E.PLANT, E.LAVA], E.NAMES, 'la');
  assert.deepEqual(groups.map(group => group.ids), [[E.PLANT], [E.LAVA]]);
});

test('recents remember the last brush and stay off the current one', () => {
  const history = rememberRecent(rememberRecent([], E.SAND), E.WATER);
  assert.deepEqual(history, [E.WATER, E.SAND]);
  assert.deepEqual(recentAround(history, E.WATER, E.STARTER, 3)[0], E.SAND);
  assert.equal(recentAround([], E.SAND, E.STARTER, 3).includes(E.SAND), false);
  assert.equal(recentAround([], E.SAND, E.STARTER, 3).length, 3);
});

test('the hold picker prefers history, then starters, and skips the current brush', () => {
  const known = new Set([E.SAND, E.WATER, E.STONE, E.FIRE, E.PLANT]);
  const ids = pickerIds(known, E.SAND, [E.PLANT, E.SAND], E.STARTER, 8);
  assert.equal(ids[0], E.PLANT);
  assert.equal(ids.includes(E.SAND), false);
  assert.ok(ids.length <= 8);
  assert.ok(ids.includes(E.WATER));
});

test('radial slots arc above the orb and a finger lands on the nearest one', () => {
  const slots = arcSlots(3, 80);
  assert.equal(slots.length, 3);
  assert.ok(slots.every(slot => slot.y < 0), 'the arc sits above the orb');
  assert.ok(slots[0].x < slots[2].x);
  const hit = nearestSlot(slots[1].x, slots[1].y, slots, 36);
  assert.equal(hit, 1);
  assert.equal(nearestSlot(400, 400, slots, 36), -1);
  const placed = placeSlot(slots[1], { x: 33, y: 51 }, 38);
  assert.ok(placed.bottom > 51, 'a slot above the orb is placed higher');
});

test('the sheet snaps between half, full, and closed', () => {
  assert.equal(nextSnap('half', -80), 'full');
  assert.equal(nextSnap('half', 80), 'closed');
  assert.equal(nextSnap('full', 80), 'half');
  assert.equal(nextSnap('full', -80), 'full');
  assert.equal(nextSnap('half', 10), 'half');
});

test('idle chrome waits until the fingers lift, then hides on a timer', () => {
  const timers = [];
  let hidden = null;
  const idle = createIdleChrome({
    idleMs: IDLE_MS,
    onChange: value => { hidden = value; },
    setTimer: (fn, ms) => { const timer = { fn, ms, cleared: false }; timers.push(timer); return timer; },
    clearTimer: timer => { if (timer) timer.cleared = true; },
  });
  const first = timers.at(-1);
  assert.equal(first.ms, 3000);
  assert.equal(HOLD_MS < IDLE_MS, true);
  idle.down();
  assert.equal(first.cleared, true, 'a finger down cancels the hide');
  idle.up();
  const armed = timers.at(-1);
  assert.equal(armed.ms, IDLE_MS);
  assert.notEqual(armed, first);
  armed.fn();
  assert.equal(hidden, true);
  assert.equal(idle.idle, true);
  idle.nudge();
  assert.equal(hidden, false);
  assert.notEqual(timers.at(-1), armed, 'showing the chrome arms a fresh timer');
  idle.stop();
  assert.equal(timers.at(-1).cleared, true);
});
