import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createTouchPour, createGlide, sampleVelocity, LONG_PRESS_MS, MOVE_SLOP } from '../public/v2/touch-gesture.js';
import * as E from '../public/v2/alembic-engine-v2.js';

function harness() {
  const log = [];
  let timer = null;
  const g = createTouchPour({
    begin: () => log.push(['begin']),
    pour: (x, y) => log.push(['pour', x, y]),
    probe: (x, y) => log.push(['probe', x, y]),
    end: () => log.push(['end']),
    undo: () => log.push(['undo']),
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

test('a finger pours on contact, before it moves', () => {
  const h = harness();
  h.g.down(10, 10);
  assert.deepEqual(h.log, [['begin'], ['pour', 10, 10]]);
  h.g.move(12, 11);
  assert.deepEqual(h.log, [['begin'], ['pour', 10, 10]], 'slop does not pour a second dab');
});

test('a drag keeps pouring after the landing dab', () => {
  const h = harness();
  h.g.down(10, 10);
  h.g.move(30, 10);
  assert.deepEqual(h.log, [['begin'], ['pour', 10, 10], ['pour', 30, 10]]);
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
  h.fire();
  h.g.move(40, 0);
  assert.ok(h.log.every(([k]) => k === 'begin' || k === 'pour'));
});

test('holding still pours immediately and then names the grain', () => {
  const h = harness();
  h.g.down(20, 20);
  assert.deepEqual(h.log, [['begin'], ['pour', 20, 20]]);
  h.fire();
  h.g.move(60, 20);
  h.g.up();
  assert.deepEqual(h.log, [['begin'], ['pour', 20, 20], ['probe', 20, 20], ['probe', 60, 20], ['end']]);
});

test('a quick tap drops one dab and does not pour again on lift', () => {
  const h = harness();
  h.g.down(5, 6);
  h.g.up();
  assert.deepEqual(h.log, [['begin'], ['pour', 5, 6], ['end']]);
});

test('a second finger undoes the dab that already poured', () => {
  const h = harness();
  h.g.down(5, 6);
  h.g.move(40, 6);
  h.g.cancel();
  h.g.up();
  assert.deepEqual(h.log, [['begin'], ['pour', 5, 6], ['pour', 40, 6], ['undo']]);
  assert.equal(h.timer(), null);
  h.g.cancel();
  assert.equal(h.log.filter(([k]) => k === 'undo').length, 1, 'a second cancel is not a second undo');
});

test('a resting pinch has no glide velocity, and a moving one keeps the latest', () => {
  const first = sampleVelocity(null, 10, 10, 1000);
  assert.equal(first.x, 0);
  const moved = sampleVelocity(first, 26, 10, 1016);
  assert.ok(moved.x > 0.4);
  const rested = sampleVelocity(moved, 26, 10, 1200);
  assert.equal(rested.x, 0);
  assert.equal(rested.y, 0);
});

test('a glide pans, decays, and stops', () => {
  const pans = [];
  let frame = null;
  const g = createGlide({
    pan: (dx, dy) => pans.push([dx, dy]),
    requestFrame: fn => { frame = fn; return 1; },
    cancelFrame: () => { frame = null; },
  });
  g.kick(0.01, 0);
  assert.equal(frame, null, 'a tiny flick does not glide');
  g.kick(1, 0);
  assert.equal(typeof frame, 'function');
  frame(100);
  frame(40);
  assert.ok(pans[0][0] > pans[1][0], 'the glide slows down even if the frame clock jumps backward');
  g.stop();
  assert.equal(frame, null);
  assert.equal(g.moving, false);
  let again = null;
  const held = createGlide({
    pan: () => false,
    requestFrame: fn => { again = fn; return 1; },
    cancelFrame: () => { again = null; },
  });
  held.kick(1, 0);
  again(10);
  assert.equal(held.moving, false, 'a glide that the camera clamp rejects stops');
});

test('a pinch puts a moved stroke back and does not punch holes', () => {
  const buffers = () => [new Uint8Array(E.N * 4), new Uint8Array(E.N * 4), new Uint8Array(E.N * 4)];
  const engine = E.createEngine({ seed: 3, scene: 'empty' });
  const stone = 30 * E.W + 12, water = 26 * E.W + 12;
  engine.tick({ paused: true, ops: [
    { t: 'p', x: 12, y: 30, r: 0, m: E.STONE },
    { t: 'p', x: 12, y: 26, r: 0, m: E.WATER },
  ] }, ...buffers());
  const w = engine.inspect();
  const shade = w.shades[stone];
  w.VX[stone] = 2.5;
  const before = engine.tick({ paused: true, ops: [{ t: 'snap' }] }, ...buffers()).snap.cells.slice();
  engine.tick({ paused: true, ops: [{ t: 'p', x: 12, y: 26, r: 1, m: E.GOLD }] }, ...buffers());
  assert.equal(w.cells[water], E.GOLD);
  engine.tick({ dt: 250, speed: 1 }, ...buffers());
  let gold = 0;
  w.cells.forEach(c => { if (c === E.GOLD) gold++; });
  assert.ok(gold > 0, 'the dab has somewhere to come back from');
  engine.tick({ paused: true, ops: [{ t: 'revert', cells: before }] }, ...buffers());
  assert.equal(w.cells[water], E.WATER, 'the cell under the dab is restored');
  assert.equal(w.cells[stone], E.STONE);
  assert.equal(w.shades[stone], shade, 'a cell the stroke never touched keeps its shade');
  assert.equal(w.VX[stone], 2.5, 'and its velocity');
  gold = 0;
  w.cells.forEach(c => { if (c === E.GOLD) gold++; });
  assert.equal(gold, 0, 'grains that already fell are gone');
});

test('undo drops a queued pour and restores the grid once the worker has taken it', () => {
  const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  const context = { DCLogic: class { constructor() { this.props = {}; } },
    React: { createRef: () => ({ current: null }) }, performance: { now: () => 0 },
    localStorage: { getItem: () => null }, requestAnimationFrame: () => 1, Float32Array,
    window: {}, clearTimeout() {} };
  vm.createContext(context);
  vm.runInContext(script + '\nthis.Component = Component;', context);
  const ui = new context.Component();
  ui.M = E;
  const queued = { t: 'p', x: 12, y: 20, r: 3, m: E.SAND };
  ui.ops = [queued, { t: 'rain', m: E.WATER, n: 1 }];
  ui.pending = [];
  ui.touchStroke = [queued];
  ui.undoTouchPour();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.ops)), [{ t: 'rain', m: E.WATER, n: 1 }], 'the unsent dab is removed and other ops stay');
  assert.equal(ui.touchStroke, null);

  const sent = { t: 'l', x0: 4, y0: 5, x1: 8, y1: 5, r: 2, m: E.SAND };
  const cells = new Uint8Array(E.N); cells[5 * E.W + 4] = E.WATER;
  ui.ops = [];
  ui.pending = [];
  ui.touchStroke = [sent];
  ui.strokeCells = cells;
  ui.undoTouchPour();
  assert.equal(ui.ops.length, 1);
  assert.equal(ui.ops[0].t, 'revert');
  assert.equal(ui.ops[0].cells[5 * E.W + 4], E.WATER);
  assert.equal(JSON.stringify(ui.ops).includes('"m":0'), false, 'the stroke is not painted back as air');
});
