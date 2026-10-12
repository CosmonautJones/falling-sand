import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as camera from '../public/v2/camera.js';
const { layout } = camera;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('portrait close view enlarges grains uniformly and includes the working floor', () => {
  const l = layout(390, 650), v = camera.closeView(l);
  const p = camera.cellToPx(l, v, { x: 264, y: 269 });
  assert.ok(p.x > 0 && p.x < 390 && p.y > 0 && p.y < 650, 'pond/cask floor is visible');
  const q = camera.cellToPx(l, v, { x: 265, y: 268 });
  near(q.x - p.x, p.y - q.y); // Square cells remain square in a tall viewport.
  assert.ok(q.x - p.x > 2.5, 'grains are larger than the original 0.8125 CSS pixels');
});

test('painting and probing round-trip through a cropped portrait camera', () => {
  const l = layout(390, 650), v = camera.closeView(l);
  for (const c of [{ x: 250, y: 100 }, { x: 264, y: 220 }, { x: 300, y: 269 }]) {
    const p = camera.cellToPx(l, v, c);
    assert.deepEqual(camera.cellAt(l, v, p.x, p.y), c);
  }
});

test('overview fits the whole vessel and does not change desktop coordinates', () => {
  const l = layout(960, 540), v = camera.clampView(l, { zoom: 1, panX: 0, panY: 0 });
  assert.deepEqual(v, { zoom: 1, panX: 0, panY: 0 });
  assert.deepEqual(camera.cellAt(l, v, 1, 1), { x: 0, y: 0 });
  assert.deepEqual(camera.cellAt(l, v, 959, 539), { x: 479, y: 269 });
});

test('zoom holds the grain under the fingers at the same screen point', () => {
  const l = layout(390, 650), a = camera.closeView(l);
  const before = camera.cellAt(l, a, 195, 325);
  const b = camera.zoomAt(l, a, a.zoom * 1.5, 195, 325);
  assert.deepEqual(camera.cellAt(l, b, 195, 325), before);
});

test('panning and zooming out cannot expose space beyond a portrait vessel', () => {
  const l = layout(390, 650);
  for (const pan of [-10000, 10000]) {
    const v = camera.clampView(l, { zoom: 0.1, panX: pan, panY: pan });
    const a = camera.cellAt(l, v, 0.01, 0.01), b = camera.cellAt(l, v, 389.99, 649.99);
    assert.ok(a.x >= 0 && a.y >= 0 && b.x < 480 && b.y < 270);
  }
});

test('a viewport resize preserves the world point at its centre', () => {
  const a = layout(390, 650), b = layout(430, 700);
  const v = camera.clampView(a, { zoom: 6, panX: -900, panY: -400 });
  const next = camera.reframe(a, b, v);
  assert.deepEqual(camera.cellAt(a, v, 195, 325), camera.cellAt(b, next, 215, 350));
});

test('render buffers preserve viewport aspect for square particles at every quality', () => {
  for (const l of [layout(390, 650), layout(960, 540), layout(3000, 1687.5)]) {
    for (const scale of [0, 1, 2]) {
      const size = camera.bufferSize(l, scale);
      assert.ok(Math.abs(size.height - size.width * l.height / l.width) <= 0.5, 'backing pixels stay square in CSS');
      assert.ok(size.width >= 480 && size.width <= 2560);
      if (scale === 0) assert.equal(size.width, 480, 'grain quality keeps a bounded render width');
    }
  }
});
