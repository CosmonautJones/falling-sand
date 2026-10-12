import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, AIR, WATER, W } from '../public/v2/alembic-engine-v2.js';
import { layout, cellToPx } from '../public/v2/camera.js';

let play;
try { play = await import('../public/v2/play.js'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const dam = () => {
  assert.equal(typeof play?.createDamCheckpoint, 'function', 'the dam toy must supply a complete checkpoint');
  const engine = createEngine();
  engine.restore(play.createDamCheckpoint());
  return engine;
};
function waterBelow(engine, y0, x0 = 0, x1 = W - 1) {
  const cells = engine.inspect().cells;
  let n = 0;
  for (let y = y0; y < 270; y++) for (let x = x0; x <= x1; x++) if (cells[y * W + x] === WATER) n++;
  return n;
}

test('the untouched dam keeps its reservoir ready for a late first gesture', () => {
  const engine = dam();
  const total = waterBelow(engine, 0);
  assert.ok(total >= 3000, 'a substantial reservoir');
  engine.advanceTicks(300);
  assert.equal(waterBelow(engine, 120), 0, 'no automatic release');
  assert.ok(waterBelow(engine, 0) >= total * 0.98, 'the reservoir remains liquid');
});

test('one ordinary eraser dab releases water into the lower playground', () => {
  const engine = dam();
  engine.advanceTicks(120);
  engine.advanceTicks(180, [{ tick: 121, sequence: 0, op: { t: 'p', x: 244, y: 115, r: 6, m: AIR } }]);
  assert.ok(waterBelow(engine, 175) > 300, 'a visible cascade reaches the lower terraces');
});

test('opposite openings send the first cascade down different sides', () => {
  const left = dam(), right = dam();
  left.advanceTicks(70, [{ tick: 1, sequence: 0, op: { t: 'p', x: 244, y: 115, r: 6, m: AIR } }]);
  right.advanceTicks(70, [{ tick: 1, sequence: 0, op: { t: 'p', x: 284, y: 115, r: 6, m: AIR } }]);
  assert.ok(waterBelow(left, 125, 200, 260) > waterBelow(right, 125, 200, 260) + 50, 'the opening influences the route');
});

test('retrying the exact toy checkpoint repeats the same physical outcome', () => {
  const engine = dam(), start = engine.checkpoint();
  const release = [{ tick: 1, sequence: 0, op: { t: 'p', x: 244, y: 115, r: 6, m: AIR } }];
  engine.advanceTicks(100, release);
  const first = engine.captureState();
  engine.restore(start);
  engine.advanceTicks(100, release);
  assert.deepEqual(engine.captureState(), first);
});

test('the toy checkpoint leaves old vessel checkpoints loadable and unchanged', () => {
  const engine = createEngine();
  engine.advanceTicks(23);
  const vessel = engine.checkpoint(), before = structuredClone(vessel);
  engine.restore(dam().checkpoint());
  engine.advanceTicks(10);
  engine.restore(vessel);
  assert.deepEqual(engine.captureState(), before.state);
  assert.deepEqual(vessel, before);
});

test('the whole dam and both landing areas fit in phone and desktop views', () => {
  assert.equal(typeof play?.damView, 'function');
  for (const [width, height] of [[390, 590], [320, 420], [720, 405], [1400, 780]]) {
    const l = layout(width, height), view = play.damView(l);
    for (const point of [{ x: 204, y: 42 }, { x: 324, y: 257 }]) {
      const px = cellToPx(l, view, point);
      assert.ok(px.x >= 0 && px.x <= width && px.y >= 0 && px.y <= height, `full playfield visible at ${width}x${height}`);
    }
  }
});
