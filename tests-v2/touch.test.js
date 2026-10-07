import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTouchPour, LONG_PRESS_MS, MOVE_SLOP } from '../public/v2/touch-gesture.js';

function harness() {
  const log = [];
  let timer = null;
  const g = createTouchPour({
    pour: (x, y) => log.push(['pour', x, y]),
    probe: (x, y) => log.push(['probe', x, y]),
    end: () => log.push(['end']),
    setTimer: (fn, ms) => { timer = { fn, ms }; return 1; },
    clearTimer: () => { timer = null; },
  });
  return { g, log, fire: () => { const t = timer; timer = null; t && t.fn(); }, timer: () => timer };
}

test('long press is 450 ms and the still threshold is 8 px', () => {
  assert.equal(LONG_PRESS_MS, 450);
  assert.equal(MOVE_SLOP, 8);
  const h = harness();
  h.g.down(10, 10);
  assert.equal(h.timer().ms, 450);
});

test('a drag always pours, starting from where the finger landed', () => {
  const h = harness();
  h.g.down(10, 10);
  h.g.move(12, 11); // inside the slop: nothing yet
  assert.deepEqual(h.log, []);
  h.g.move(30, 10);
  assert.deepEqual(h.log, [['pour', 10, 10], ['pour', 30, 10]]);
  assert.equal(h.timer(), null, 'moving cancels the long press');
  h.g.move(50, 12);
  h.g.up();
  assert.deepEqual(h.log.at(-2), ['pour', 50, 12]);
  assert.deepEqual(h.log.at(-1), ['end']);
});

test('a slow drag that moves before 450 ms still pours, never probes', () => {
  const h = harness();
  h.g.down(0, 0);
  h.g.move(9, 0);
  h.fire(); // a stale timer must not turn the pour into a probe
  h.g.move(40, 0);
  assert.ok(h.log.every(([k]) => k === 'pour'));
});

test('holding still for 450 ms names the grain and never pours', () => {
  const h = harness();
  h.g.down(20, 20);
  h.fire();
  assert.deepEqual(h.log, [['probe', 20, 20]]);
  h.g.move(60, 20); // the name follows the finger
  h.g.up();
  assert.deepEqual(h.log, [['probe', 20, 20], ['probe', 60, 20], ['end']]);
});

test('a quick tap drops one dab', () => {
  const h = harness();
  h.g.down(5, 6);
  h.g.up();
  assert.deepEqual(h.log, [['pour', 5, 6], ['end']]);
});

test('a second finger cancels without pouring', () => {
  const h = harness();
  h.g.down(5, 6);
  h.g.cancel();
  h.g.up();
  assert.deepEqual(h.log, [['end']]);
  assert.equal(h.timer(), null);
});
