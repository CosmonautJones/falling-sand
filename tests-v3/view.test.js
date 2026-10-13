import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createView,
  worldPoint,
  zoomView,
  panView,
  advanceClock,
  createStroke,
} from '../public/v3/view.js';

test('overview contains the whole world without distorting square grains', () => {
  const view = createView(360, 540, false);
  assert.equal(view.scale, 0.75);
  assert.deepEqual(worldPoint(view, 180, 270), { x: 240, y: 135 });
  assert.equal(worldPoint(view, 10, 10), null);
});
test('portrait starts close enough to play, and zoom stays pinned to its focal point', () => {
  const view = createView(360, 540, true);
  const point = worldPoint(view, 180, 240);
  zoomView(view, 1.6, 180, 240);
  const after = worldPoint(view, 180, 240);
  assert.ok(Math.abs(point.x - after.x) < 1e-9);
  assert.ok(Math.abs(point.y - after.y) < 1e-9);
  panView(view, 100000, -100000);
  assert.ok(view.x <= 0 && view.x + 480 * view.scale >= 360);
  assert.ok(view.y <= 0 && view.y + 270 * view.scale >= 540);
});
test('clock caps catch-up and paused or hidden time cannot advance ecology', () => {
  const clock = { acc: 0 };
  assert.equal(advanceClock(clock, 1000, true, false), 0);
  assert.equal(advanceClock(clock, 1000, false, true), 0);
  assert.equal(advanceClock(clock, 1000, false, false), 2);
  assert.equal(advanceClock(clock, 1000, false, false), 3);
  assert.ok(clock.acc < 1000 / 60);
});
test('touch begins with a short gesture window and a second finger cancels every dab', () => {
  const stroke = createStroke();
  stroke.begin(0, 75);
  assert.equal(stroke.sample(16), false);
  stroke.cancel();
  assert.equal(stroke.sample(100), false);
  assert.equal(stroke.finish(), false);
});
test('a quick tap produces one dab, while a held stroke never adds an extra release dab', () => {
  const stroke = createStroke();
  stroke.begin(0, 75);
  assert.equal(stroke.finish(), true);
  assert.equal(stroke.finish(), false);
  stroke.begin(100, 75);
  assert.equal(stroke.sample(176), true);
  assert.equal(stroke.sample(200), true);
  assert.equal(stroke.finish(), false);
});
