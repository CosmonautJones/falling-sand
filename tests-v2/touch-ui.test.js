import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';
import {
  IDLE_MS, HOLD_MS, arcSlots, createIdleChrome, familyOf, fanRadius, groupKnown, nearestSlot, nextSnap,
  clampFanRadius, pickerIds, placeSlot, recentAround, rememberRecent,
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
  const recents = arcSlots(3, 78).map(slot => placeSlot(slot, { x: 33, y: 51 }, 38));
  assert.ok(recents.every(slot => slot.left >= 0), 'recents stay on screen beside a left-edge orb');
  const picker = arcSlots(8, fanRadius(8, 46)).map(slot => placeSlot(slot, { x: 33, y: 51 }, 44));
  assert.ok(picker.every(slot => slot.left >= 0), 'the hold fan stays to the right of the left edge');
  assert.ok(picker[0].bottom > picker[7].bottom);
  // 844×390 with the wrap sitting on a 21px home inset: an unclamped fan tops out at y=-6.
  const origin = { x: 33, y: 51 }, size = 44;
  const bounds = { minLeft: 0, maxRight: 780, minBottom: 0, maxTop: 390 - 21 };
  const fit = clampFanRadius(fanRadius(8, 46), origin, size, bounds);
  const fitted = arcSlots(8, fit).map(slot => placeSlot(slot, origin, size, bounds));
  assert.ok(fit < fanRadius(8, 46), 'the fan shrinks to the safe viewport');
  assert.ok(fitted.every(slot => slot.bottom + size <= bounds.maxTop + 0.01), 'no slot crosses the top edge');
  assert.ok(fitted.every(slot => slot.left >= bounds.minLeft && slot.left + size <= bounds.maxRight));
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
