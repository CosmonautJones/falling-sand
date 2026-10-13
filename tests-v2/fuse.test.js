import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';
import * as play from '../public/v2/play.js';
import { layout, cellToPx } from '../public/v2/camera.js';

function fuse() {
  assert.equal(typeof play.createFuseCheckpoint, 'function', 'the fuse toy supplies a real checkpoint');
  const engine = E.createEngine();
  engine.restore(play.createFuseCheckpoint());
  return engine;
}
const spark = (x, y, tick = 1) => ({ tick, sequence: 0, op: { t: 'p', x, y, r: 3, m: E.FIRE } });

test('the fuse waits for the player and stays ready after five seconds', () => {
  const engine = fuse();
  const before = engine.inspect().cells.filter(m => m === E.TNT).length;
  assert.ok(before > 200, 'several visible casks');
  const result = engine.advanceTicks(300);
  assert.equal(result.filter(e => e.t === 'blast').length, 0);
  assert.equal(engine.inspect().cells.filter(m => m === E.TNT).length, before);
  assert.equal(engine.inspect().cells[92 * E.W + 260], E.POWDER, 'the suggested fuse stays reachable');
});

test('one fire dab runs along the fuse into a visible chain within five seconds', () => {
  const engine = fuse();
  const result = engine.advanceTicks(300, [spark(260, 92)]);
  const blasts = result.filter(e => e.t === 'blast');
  assert.ok(blasts.length >= 12, 'one spark reaches multiple cask grains');
  assert.ok(blasts.some(e => e.y < 100), 'the upper casks ignite');
  assert.ok(blasts.some(e => e.y > 135), 'the chain reaches a lower tier');
});

test('choosing a different fuse changes where the first cask explodes', () => {
  const a = fuse(), b = fuse();
  const first = events => events.find(e => e.t === 'blast');
  const top = a.advanceTicks(180, [spark(260, 92)]);
  const bottom = b.advanceTicks(180, [spark(260, 209)]);
  assert.ok(first(top)); assert.ok(first(bottom));
  assert.ok(first(top).y < 100);
  assert.ok(first(bottom).y > 195);
});

test('erasing a break in a fuse lets the player spare an upper cask', () => {
  const engine = fuse();
  const edits = [
    { tick: 1, sequence: 0, op: { t: 'p', x: 239, y: 90, r: 9, m: E.AIR } },
    { tick: 1, sequence: 1, op: { t: 'p', x: 283, y: 90, r: 9, m: E.AIR } },
    { ...spark(260, 92, 2), sequence: 2 },
  ];
  const result = engine.advanceTicks(180, edits);
  assert.equal(result.filter(e => e.t === 'blast').length, 0, 'a real gap interrupts the chain');
});

test('Again repeats the same reaction and the fuse scene fits phone views', () => {
  const engine = fuse(), start = engine.checkpoint();
  engine.advanceTicks(150, [spark(260, 92)]);
  const reacted = engine.captureState();
  engine.restore(start);
  engine.advanceTicks(150, [spark(260, 92)]);
  assert.deepEqual(engine.captureState(), reacted);
  assert.equal(typeof play.fuseView, 'function');
  for (const [w, h] of [[390, 590], [320, 420], [720, 405], [1400, 780]]) {
    const l = layout(w, h), view = play.fuseView(l);
    for (const point of [{ x: 196, y: 48 }, { x: 324, y: 255 }]) {
      const px = cellToPx(l, view, point);
      assert.ok(px.x >= 0 && px.x <= w && px.y >= 0 && px.y <= h);
    }
  }
});
