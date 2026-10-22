import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createTouchPour, createGlide, sampleVelocity, LONG_PRESS_MS, MOVE_SLOP } from '../public/v2/touch-gesture.js';
import * as cam from '../public/v2/camera.js';
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

test('a pinch puts the stroke footprint back and leaves the rest of the world', () => {
  const buffers = () => [new Uint8Array(E.N * 4), new Uint8Array(E.N * 4), new Uint8Array(E.N * 4)];
  const engine = E.createEngine({ seed: 3, scene: 'empty' });
  const stone = 30 * E.W + 12, water = 26 * E.W + 12;
  engine.tick({ paused: true, ops: [
    { t: 'p', x: 12, y: 30, r: 0, m: E.STONE },
    { t: 'p', x: 12, y: 26, r: 0, m: E.WATER },
    { t: 'box', x0: 200, y0: 80, x1: 239, y1: 99, m: E.BRICK },
  ] }, ...buffers());
  const w = engine.inspect();
  const shade = w.shades[stone];
  w.VX[stone] = 2.5;
  const prior = w.cells.slice();
  engine.tick({ paused: true, ops: [{ t: 'p', x: 12, y: 26, r: 1, m: E.GOLD, mark: 1 }] }, ...buffers());
  assert.equal(w.cells[water], E.GOLD);
  engine.tick({ dt: 250, speed: 1 }, ...buffers());
  let gold = 0;
  w.cells.forEach(c => { if (c === E.GOLD) gold++; });
  assert.ok(gold > 0, 'the dab has somewhere to come back from');
  // A brick laid on the stroke after the dab is not the dab, so the revert leaves it.
  w.setc(13, 26, E.BRICK, 4);
  const idx = [], was = [], span = [], brush = new Set();
  for (let y = 25; y <= 27; y++) for (let x = 11; x <= 13; x++) {
    if ((x - 12) * (x - 12) + (y - 26) * (y - 26) <= 1) brush.add(y * E.W + x);
  }
  for (let x = 9; x <= 15; x++) for (let y = 0; y < E.H; y++) {
    const i = y * E.W + x;
    idx.push(i); was.push(prior[i]); span.push(brush.has(i) ? 1 : 0);
  }
  engine.tick({ paused: true, ops: [{
    t: 'revert', m: E.GOLD,
    idx: Uint32Array.from(idx), prior: Uint8Array.from(was), span: Uint8Array.from(span),
  }] }, ...buffers());
  assert.equal(w.cells[water], E.WATER, 'the cell under the dab is restored');
  assert.equal(w.cells[stone], E.STONE);
  assert.equal(w.shades[stone], shade, 'a cell the dab never replaced keeps its shade');
  assert.equal(w.VX[stone], 2.5, 'and its velocity');
  assert.equal(w.cells[26 * E.W + 13], E.BRICK, 'a brick placed on the stroke stays');
  gold = 0;
  let bricks = 0;
  w.cells.forEach(c => { if (c === E.GOLD) gold++; if (c === E.BRICK) bricks++; });
  assert.equal(gold, 0, 'grains that fell down the touched columns are gone');
  assert.equal(bricks, 801, 'the box elsewhere is still there');
});

test('undo drops a queued pour and restores the grid once the worker has taken it', () => {
  const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  const context = { DCLogic: class { constructor() { this.props = {}; } },
    React: { createRef: () => ({ current: null }) }, performance: { now: () => 0 },
    localStorage: { getItem: () => null }, requestAnimationFrame: () => 1, Float32Array, Uint32Array, Uint8Array,
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
  const at = 5 * E.W + 4;
  ui.ops = [];
  ui.pending = [];
  ui.touchStroke = [sent];
  ui.strokeFoot = { m: E.SAND, idx: [at], prior: [E.WATER], span: [1] };
  ui.undoTouchPour();
  assert.equal(ui.ops.length, 1);
  assert.equal(ui.ops[0].t, 'revert');
  assert.equal(ui.ops[0].m, E.SAND);
  assert.equal(ui.ops[0].idx[0], at);
  assert.equal(ui.ops[0].prior[0], E.WATER);
  assert.equal(ui.ops[0].span[0], 1);
  assert.ok(ui.ops[0].idx.length < E.N, 'the revert is the footprint, not the grid');
  assert.equal(JSON.stringify(ui.ops).includes('"m":0'), false, 'the stroke is not painted back as air');
});

function page() {
  const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  const timers = [];
  const context = {
    DCLogic: class { constructor() { this.props = {}; } },
    React: { createRef: () => ({ current: null }) },
    performance: { now: () => 0 },
    localStorage: { getItem: () => null },
    requestAnimationFrame: () => 1,
    Float32Array, Uint32Array, Uint8Array,
    window: {},
    setTimeout(fn, ms) { return timers.push({ fn, ms }); },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].fn = null; },
  };
  vm.createContext(context);
  vm.runInContext(script + '\nthis.Component = Component;', context);
  const ui = new context.Component();
  ui.M = E; ui.ops = []; ui.pending = [];
  return { ui, timers };
}

test('the first dab waits 120 ms, and lifting the finger still pours', () => {
  const dab = () => ({ t: 'p', x: 12, y: 20, r: 1, m: E.GOLD });
  const early = page();
  early.ui.beginTouchStroke();
  early.ui.queueTouchPour(dab());
  assert.equal(early.ui.ops.length, 0, 'nothing is committed while the hold is open');
  assert.equal(early.timers[0].ms, 120);
  early.ui.undoTouchPour();
  assert.deepEqual(early.ui.ops, [], 'a pinch inside the hold commits nothing');
  early.timers[0].fn?.();
  assert.deepEqual(early.ui.ops, [], 'a timer that fires after the pinch does not pour');

  const held = page();
  held.ui.beginTouchStroke();
  held.ui.queueTouchPour(dab());
  held.timers[0].fn();
  assert.equal(held.ui.ops.length, 1);
  assert.equal(held.ui.ops[0].mark, 1, 'a committed touch dab is tagged');
  held.ui.queueTouchPour({ t: 'l', x0: 12, y0: 20, x1: 16, y1: 20, r: 1, m: E.GOLD });
  assert.equal(held.ui.ops.length, 2, 'later dabs in the same stroke are not held again');
  assert.equal(held.ui.ops[1].mark, 1);
  held.ui.ops = []; held.ui.pending = [];
  held.ui.undoTouchPour();
  assert.equal(held.ui.ops[0].t, 'revert');
  assert.equal(held.ui.ops[0].m, E.GOLD);

  const tap = page();
  tap.ui.beginTouchStroke();
  tap.ui.queueTouchPour(dab());
  tap.ui.endTouchStroke();
  assert.equal(tap.ui.ops[0].mark, 1, 'a tap shorter than the hold still pours on lift');
  assert.equal(tap.ui.ops[1].t, 'untag', 'lifting the finger drops the tags so the grains stay');
});

const countMat = (cells, m) => {
  let n = 0;
  for (const c of cells) if (c === m) n++;
  return n;
};

function strokeFootprint(prior, cx, cy, r) {
  const idx = [], was = [], span = [], brush = new Set();
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) brush.add(y * E.W + x);
  }
  for (let x = cx - r - 2; x <= cx + r + 2; x++) for (let y = 0; y < E.H; y++) {
    const i = y * E.W + x;
    idx.push(i); was.push(prior[i]); span.push(brush.has(i) ? 1 : 0);
  }
  return { idx: Uint32Array.from(idx), prior: Uint8Array.from(was), span: Uint8Array.from(span) };
}

function simulateMs(engine, ms, buf) {
  const step = 1000 / 60;
  let left = ms;
  while (left > 1e-6) {
    const dt = Math.min(left, step * 8);
    engine.tick({ dt, speed: 1 }, ...buf);
    left -= dt;
  }
}

// The dab is committed immediately here. That is the harder case: a pinch before
// 120 ms never commits, and these counts are what remains after a dab that did.
test('a pinch removes a tagged dab wherever it slid, and leaves other edits', () => {
  const holds = [100, 300, 600, 1000];
  const materials = [['gold', E.GOLD], ['sand', E.SAND], ['water', E.WATER], ['salt', E.SALT]];
  const buf = () => [new Uint8Array(E.N * 4), new Uint8Array(E.N * 4), new Uint8Array(E.N * 4)];
  for (const [name, mat] of materials) {
    for (const paused of [false, true]) {
      for (const ms of holds) {
        const color = buf();
        const engine = E.createEngine({ seed: 3, scene: 'empty', weather: false, ambientEmbers: false });
        const setup = [
          { t: 'box', x0: 0, y0: 55, x1: 479, y1: 59, m: E.STONE },
          { t: 'box', x0: 10, y0: 10, x1: 30, y1: 30, m: E.STONE },
          { t: 'p', x: 20, y: 20, r: 0, m: mat },
        ];
        if (mat !== E.WATER) setup.push({ t: 'p', x: 240, y: 30, r: 0, m: E.WATER });
        engine.tick({ paused: true, ops: setup }, ...color);
        const w = engine.inspect();
        const prior = w.cells.slice();
        const keeper = 20 * E.W + 20;
        engine.tick({ paused: true, ops: [{ t: 'p', x: 240, y: 30, r: 1, m: mat, mark: 1 }] }, ...color);
        w.setc(241, 30, E.BRICK, 4);
        engine.tick({ paused: true, ops: [{ t: 'box', x0: 400, y0: 10, x1: 430, y1: 30, m: E.BRICK }] }, ...color);
        const bricks = countMat(w.cells, E.BRICK);
        if (!paused) simulateMs(engine, ms, color);
        const foot = strokeFootprint(prior, 240, 30, 1);
        engine.tick({ paused: true, ops: [{ t: 'revert', m: mat, ...foot }] }, ...color);
        const leftover = countMat(w.cells, mat) - 1;
        assert.equal(w.cells[keeper], mat, `${name} ${paused ? 'paused' : 'running'} ${ms}ms keeps the sealed grain`);
        assert.equal(leftover, 0, `${name} ${paused ? 'paused' : 'running'} ${ms}ms leaves no dab`);
        assert.equal(countMat(w.cells, E.BRICK), bricks, `${name} keeps the brick box and the brick on the stroke`);
        if (mat !== E.WATER) assert.equal(w.cells[30 * E.W + 240], E.WATER, 'the cell under the dab is restored');
      }
    }
  }
  // No other edits, so the slide is the one a flat floor produces. The column band
  // cannot see these grains; the mark has to.
  for (const [name, mat] of materials) {
    for (const ms of [600, 1000]) {
      const color = buf();
      const engine = E.createEngine({ seed: 3, scene: 'empty', weather: false, ambientEmbers: false });
      engine.tick({ paused: true, ops: [{ t: 'box', x0: 0, y0: 55, x1: 479, y1: 59, m: E.STONE }] }, ...color);
      const w = engine.inspect();
      const prior = w.cells.slice();
      engine.tick({ paused: true, ops: [{ t: 'p', x: 240, y: 30, r: 1, m: mat, mark: 1 }] }, ...color);
      simulateMs(engine, ms, color);
      let far = 0;
      for (let i = 0; i < E.N; i++) {
        if (!w.pourMark[i] || w.cells[i] !== mat) continue;
        const x = i % E.W;
        if (x < 237 || x > 243) far++;
      }
      assert.ok(far > 0, `${name} at ${ms}ms leaves the column band`);
      const foot = strokeFootprint(prior, 240, 30, 1);
      engine.tick({ paused: true, ops: [{ t: 'revert', m: mat, ...foot }] }, ...color);
      assert.equal(countMat(w.cells, mat), 0, `${name} at ${ms}ms is removed past the band`);
    }
  }
  const state = E.createEngine({ seed: 1, scene: 'empty', weather: false, ambientEmbers: false });
  const color = buf();
  state.tick({ paused: true, ops: [{ t: 'p', x: 5, y: 5, r: 0, m: E.GOLD, mark: 1 }] }, ...color);
  assert.equal(state.inspect().pourMark[5 * E.W + 5], 1);
  assert.equal(state.captureState().pourMark, undefined, 'pour marks are not part of a checkpoint');
  const saved = state.checkpoint();
  simulateMs(state, 100, color);
  state.restore(saved);
  assert.ok([...state.inspect().pourMark].every(v => v === 0), 'restoring a world clears ephemeral marks');
});

// The page's real pointer path. send() attaches held: toolTick() every frame the
// finger is down, which is the stream a single marked dab never exercises.
function touchPage() {
  const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
  const script = html.match(
    /<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/,
  )[1];
  const timers = [];
  const window = {
    addEventListener() {},
    removeEventListener() {},
  };
  const context = {
    DCLogic: class {
      constructor() {
        this.props = {};
      }
    },
    React: { createRef: () => ({ current: null }) },
    performance: { now: () => 0 },
    localStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    Float32Array,
    Uint32Array,
    Uint8Array,
    ArrayBuffer,
    Map,
    Set,
    window,
    setTimeout(fn, ms) {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimeout(id) {
      if (timers[id - 1]) timers[id - 1].fn = null;
    },
  };
  vm.createContext(context);
  vm.runInContext(script + '\nthis.Component = Component;', context);
  const ui = new context.Component();
  ui.M = E;
  ui.setState = (patch, cb) => {
    if (patch && typeof patch === 'object') Object.assign(ui.state, patch);
    if (typeof cb === 'function') cb();
  };
  ui.vw = 390;
  ui.vh = 844;
  const listeners = {};
  const vp = {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: ui.vw,
      height: ui.vh,
      right: ui.vw,
      bottom: ui.vh,
    }),
    setPointerCapture() {},
    releasePointerCapture() {},
    addEventListener(ev, fn) {
      (listeners[ev] ||= []).push(fn);
    },
    removeEventListener() {},
  };
  ui.vpRef = { current: vp };
  ui.retRef = { current: null };
  ui.rootRef = { current: null };
  ui.touchMod = {
    createTouchPour,
    createGlide: (opts) => createGlide({ requestFrame: () => 1, cancelFrame() {}, ...opts }),
  };
  ui.cam = ui.decorateCam(cam);
  ui.view = ui.cam.defaultView(ui.vw, ui.vh);
  ui.viewT = ui.view;
  ui.mode = 'local';
  ui.onFrame = () => {
    ui.sawFrame = true;
    if (ui.lastColor && ui.bufs) ui.lastColor.set(new Uint8Array(ui.bufs[0]));
    ui.have = true;
  };
  ui.bindInput();
  const scr = ui.cam.grainToScreen(ui.vw, ui.vh, ui.view, 240, 30);
  const fire = (type, pointerId, x, y, pointerType = 'touch') => {
    const e = {
      type,
      pointerId,
      pointerType,
      button: 0,
      altKey: false,
      clientX: x,
      clientY: y,
      buttons: 1,
      target: { closest: () => null },
      preventDefault() {},
      stopPropagation() {},
    };
    for (const fn of listeners[type] || []) fn(e);
  };
  const heldMarks = [];
  const tick = ui.toolTick.bind(ui);
  ui.toolTick = () => {
    const op = tick();
    if (op) heldMarks.push(op.mark);
    return op;
  };
  // The page runs inside vm, so its arrays and op objects are not the host's.
  // The engine only accepts host objects. Copy at the send boundary.
  const hostOp = (op) => {
    const out = {};
    for (const k of Object.keys(op)) out[k] = op[k];
    return out;
  };
  const hostList = (list) => {
    const out = [];
    for (const op of list || []) out.push(hostOp(op));
    return out;
  };
  const realSend = ui.send.bind(ui);
  ui.send = function () {
    const prev = this.toolTick;
    this.ops = hostList(this.ops);
    this.toolTick = () => {
      const op = prev.call(this);
      return op ? hostOp(op) : null;
    };
    try {
      return realSend();
    } finally {
      this.toolTick = prev;
      this.ops = [];
    }
  };
  return { ui, timers, fire, scr, heldMarks };
}

function resetStroke(ui, timers) {
  ui.ptrs?.clear();
  ui.gesture = 'none';
  ui.painting = false;
  ui.lastCell = null;
  ui.curCell = null;
  ui.dragStart = null;
  ui.ops = [];
  ui.pending = [];
  ui.pendingDt = 0;
  ui.stepQ = 0;
  ui.touchStroke = null;
  ui.touchHold = null;
  ui.touchHoldT = 0;
  ui.touchLive = false;
  ui.touchMarked = false;
  ui.strokeFoot = null;
  ui.flingV = null;
  for (const t of timers) t.fn = null;
}

function seedHold(ui, mat, paused) {
  const bufs = [new ArrayBuffer(E.N * 4), new ArrayBuffer(E.N * 4), new ArrayBuffer(E.N * 4)];
  const engine = E.createEngine({ seed: 3, scene: 'empty', weather: false, ambientEmbers: false });
  const setup = [
    { t: 'box', x0: 0, y0: 55, x1: 479, y1: 59, m: E.STONE },
    { t: 'box', x0: 10, y0: 10, x1: 30, y1: 30, m: E.STONE },
    { t: 'p', x: 20, y: 20, r: 0, m: mat },
  ];
  if (mat !== E.WATER) setup.push({ t: 'p', x: 240, y: 30, r: 0, m: E.WATER });
  const planes = bufs.map((b) => new Uint8Array(b));
  engine.tick({ paused: true, ops: setup }, ...planes);
  ui.eng = engine;
  ui.bufs = bufs;
  ui.lastColor = new Uint8Array(E.N * 4);
  ui.lastColor.set(planes[0]);
  ui.sawFrame = true;
  ui.state.tool = 'pour';
  ui.state.brush = mat;
  ui.state.radius = 1;
  ui.state.paused = paused;
  ui.state.pourHint = false;
  ui.state.speed = 1;
  ui.state.walkerIn = false;
  ui.state.probe = { on: false };
  return engine;
}

function taggedCount(w, mat) {
  let n = 0;
  for (let i = 0; i < E.N; i++) if (w.pourMark[i] && w.cells[i] === mat) n++;
  return n;
}

test('a live touch hold tags every held pour, and a pinch takes the grains back', () => {
  const { ui, timers, fire, scr, heldMarks } = touchPage();
  const cell = ui.cellAt(scr.x, scr.y);
  assert.equal(cell.x, 240);
  assert.equal(cell.y, 30);
  const frame = 1000 / 60;
  const holds = [100, 300, 600, 1000];
  const materials = [
    ['gold', E.GOLD],
    ['sand', E.SAND],
    ['water', E.WATER],
    ['salt', E.SALT],
  ];
  const table = {};
  const keeper = 20 * E.W + 20;
  for (const [name, mat] of materials) {
    for (const paused of [false, true]) {
      for (const ms of holds) {
        const label = `${name} ${paused ? 'paused' : 'running'} ${ms}ms`;
        resetStroke(ui, timers);
        heldMarks.length = 0;
        const engine = seedHold(ui, mat, paused);
        const base = countMat(engine.inspect().cells, mat);
        fire('pointerdown', 1, scr.x, scr.y);
        assert.equal(ui.painting, true, label);
        assert.equal(ui.ops.length, 0, `${label} queues the first dab`);
        assert.equal(ui.toolTick(), null, `${label} sends nothing while the hold is open`);
        const n = Math.round(ms / frame);
        let flushed = false;
        for (let i = 0; i < n; i++) {
          const t = (i + 1) * frame;
          if (!flushed && t >= 120) {
            const timer = timers.find((tm) => tm.fn && tm.ms === 120);
            assert.ok(timer, `${label} arms the 120 ms hold`);
            timer.fn();
            flushed = true;
            assert.equal(ui.ops[0]?.mark, 1, `${label} flushes a tagged dab`);
            assert.equal(
              countMat(engine.inspect().cells, mat),
              base,
              `${label} waits to send the flush`,
            );
          }
          ui.pendingDt = frame;
          ui.send();
          if (t < 120 - 1e-6)
            assert.equal(
              countMat(engine.inspect().cells, mat),
              base,
              `${label} has no grains at ${t.toFixed(0)}ms`,
            );
        }
        const w = engine.inspect();
        const mid = countMat(w.cells, mat);
        if (ms <= 120) {
          assert.equal(mid, base, `${label} pours nothing inside the hold`);
          assert.equal(heldMarks.length, 0, `${label} held stream is silent inside the hold`);
        } else {
          assert.ok(mid > base, `${label} does pour once the hold flushes`);
          assert.ok(heldMarks.length > 0, `${label} held ticks ran`);
          assert.ok(
            heldMarks.every((m) => m === 1),
            `${label} held pours carry the stroke tag`,
          );
          if (!paused)
            assert.ok(taggedCount(w, mat) > 5, `${label} tags the grains the held ticks added`);
        }
        w.setc(241, 30, E.BRICK, 4);
        ui.ops.push({ t: 'box', x0: 400, y0: 10, x1: 430, y1: 30, m: E.BRICK });
        fire('pointerdown', 2, scr.x + 80, scr.y + 40);
        ui.state.paused = true;
        ui.pendingDt = 0;
        ui.send();
        const after = engine.inspect();
        const leftover = countMat(after.cells, mat) - 1;
        table[label] = leftover;
        assert.equal(after.cells[keeper], mat, `${label} keeps the sealed grain`);
        assert.equal(leftover, 0, `${label} leaves no dab`);
        assert.equal(
          after.cells[30 * E.W + 241],
          E.BRICK,
          `${label} keeps the brick on the stroke`,
        );
        assert.equal(countMat(after.cells, E.BRICK), 652, `${label} keeps the brick box`);
      }
    }
  }
  assert.equal(
    Object.values(table).every((n) => n === 0),
    true,
  );

  resetStroke(ui, timers);
  heldMarks.length = 0;
  const tapEngine = seedHold(ui, E.GOLD, false);
  const tapBase = countMat(tapEngine.inspect().cells, E.GOLD);
  fire('pointerdown', 1, scr.x, scr.y);
  for (let i = 0; i < 2; i++) {
    ui.pendingDt = frame;
    ui.send();
  }
  assert.equal(
    countMat(tapEngine.inspect().cells, E.GOLD),
    tapBase,
    'a quick tap sends nothing before the finger lifts',
  );
  assert.equal(heldMarks.length, 0);
  fire('pointerup', 1, scr.x, scr.y);
  assert.equal(ui.ops[0].mark, 1, 'lifting before 120 ms still flushes a tagged dab');
  assert.equal(ui.ops[1].t, 'untag');
  ui.pendingDt = frame;
  ui.send();
  assert.ok(countMat(tapEngine.inspect().cells, E.GOLD) > tapBase, 'the quick tap pours');
  assert.ok(
    [...tapEngine.inspect().pourMark].every((v) => v === 0),
    'finger-up drops the tags so the grains stay',
  );

  resetStroke(ui, timers);
  heldMarks.length = 0;
  ui.state.tool = 'pour';
  ui.state.brush = E.SAND;
  ui.state.radius = 1;
  ui.touchStroke = null;
  fire('pointerdown', 1, scr.x, scr.y, 'mouse');
  assert.equal(ui.ops.length, 1, 'a mouse dab is not held for 120 ms');
  assert.equal(ui.ops[0].t, 'p');
  assert.equal(ui.ops[0].mark, undefined, 'a mouse dab is not part of a touch stroke');
  const mouseHeld = ui.toolTick();
  assert.equal(mouseHeld.t, 'p');
  assert.equal(mouseHeld.mark, undefined, 'a mouse held tick stays untagged');

  resetStroke(ui, timers);
  heldMarks.length = 0;
  ui.state.tool = 'spray';
  ui.state.brush = E.GOLD;
  ui.state.radius = 1;
  fire('pointerdown', 1, scr.x, scr.y);
  assert.equal(ui.ops.length, 0, 'a spray dab waits out the same hold');
  assert.equal(ui.touchHold[0].t, 'spray');
  assert.equal(ui.toolTick(), null);
  timers.find((tm) => tm.fn && tm.ms === 120).fn();
  assert.equal(ui.ops[0].t, 'spray');
  assert.equal(ui.ops[0].mark, 1);
  const sprayHeld = ui.toolTick();
  assert.equal(sprayHeld.t, 'spray');
  assert.equal(sprayHeld.mark, 1, 'held spray ticks carry the stroke tag');
});

test('a fractional spray paints the same cells with or without a tag, and the tag covers them', () => {
  const radii = E.BRUSH_SIZES.map((size) => Math.max(2, size * 1.6));
  const planes = () => [new Uint8Array(E.N * 4), new Uint8Array(E.N * 4), new Uint8Array(E.N * 4)];
  for (const r of radii) {
    const shoot = (mark) => {
      const engine = E.createEngine({ seed: 11, scene: 'empty', weather: false, ambientEmbers: false });
      const op = { t: 'spray', x: 240, y: 40, r, m: E.GOLD, n: 40 };
      if (mark) op.mark = 1;
      engine.tick({ paused: true, ops: [op] }, ...planes());
      const w = engine.inspect();
      const at = [];
      let tagged = 0;
      for (let i = 0; i < E.N; i++) {
        if (w.cells[i] === E.GOLD) at.push(i);
        if (w.pourMark[i]) tagged++;
      }
      return { at, tagged };
    };
    const plain = shoot(false);
    const marked = shoot(true);
    assert.deepEqual(marked.at, plain.at, `r ${r} paints the same cells either way`);
    assert.ok(plain.at.length > 0, `r ${r} sprays a grain`);
    assert.equal(plain.tagged, 0);
    assert.equal(marked.tagged, marked.at.length, `r ${r} tags every sprayed grain`);
  }
});

test('a live gold spray at every brush size is removed by a pinch', () => {
  const { ui, timers, fire, scr, heldMarks } = touchPage();
  const frame = 1000 / 60;
  const keeper = 20 * E.W + 20;
  const table = {};
  for (const paused of [false, true]) {
    for (const size of E.BRUSH_SIZES) {
      const label = `gold spray ${paused ? 'paused' : 'running'} size ${size}`;
      resetStroke(ui, timers);
      heldMarks.length = 0;
      const engine = seedHold(ui, E.GOLD, paused);
      ui.state.tool = 'spray';
      ui.state.radius = size;
      const base = countMat(engine.inspect().cells, E.GOLD);
      fire('pointerdown', 1, scr.x, scr.y);
      assert.equal(ui.toolTick(), null, `${label} waits out the hold`);
      const expectR = Math.max(2, size * 1.6);
      const n = Math.round(600 / frame);
      let flushed = false;
      for (let i = 0; i < n; i++) {
        const t = (i + 1) * frame;
        if (!flushed && t >= 120) {
          const timer = timers.find((tm) => tm.fn && tm.ms === 120);
          assert.ok(timer, label);
          timer.fn();
          flushed = true;
          assert.equal(ui.ops[0].t, 'spray', label);
          assert.equal(ui.ops[0].mark, 1, label);
          assert.equal(ui.ops[0].r, expectR, `${label} keeps the spray radius`);
        }
        ui.pendingDt = frame;
        ui.send();
      }
      const w = engine.inspect();
      assert.ok(countMat(w.cells, E.GOLD) > base, `${label} sprays`);
      assert.ok(heldMarks.length > 0 && heldMarks.every((m) => m === 1), `${label} held ticks are tagged`);
      w.setc(241, 30, E.BRICK, 4);
      ui.ops.push({ t: 'box', x0: 400, y0: 10, x1: 430, y1: 30, m: E.BRICK });
      fire('pointerdown', 2, scr.x + 80, scr.y + 40);
      ui.state.paused = true;
      ui.pendingDt = 0;
      ui.send();
      const after = engine.inspect();
      const leftover = countMat(after.cells, E.GOLD) - 1;
      table[label] = leftover;
      assert.equal(after.cells[keeper], E.GOLD, `${label} keeps the sealed grain`);
      assert.equal(leftover, 0, `${label} leaves no spray`);
      assert.equal(after.cells[30 * E.W + 241], E.BRICK, `${label} keeps the brick on the stroke`);
    }
  }
  assert.deepEqual(table, {
    'gold spray running size 1': 0,
    'gold spray running size 3': 0,
    'gold spray running size 6': 0,
    'gold spray running size 12': 0,
    'gold spray running size 22': 0,
    'gold spray paused size 1': 0,
    'gold spray paused size 3': 0,
    'gold spray paused size 6': 0,
    'gold spray paused size 12': 0,
    'gold spray paused size 22': 0,
  });
});

test('a pinch removes salt that has already become brine, and leaves other brine', () => {
  const color = [new Uint8Array(E.N * 4), new Uint8Array(E.N * 4), new Uint8Array(E.N * 4)];
  const engine = E.createEngine({ seed: 3, scene: 'empty', weather: false, ambientEmbers: false });
  engine.tick({ paused: true, ops: [
    { t: 'box', x0: 0, y0: 55, x1: 479, y1: 59, m: E.STONE },
    { t: 'box', x0: 10, y0: 10, x1: 30, y1: 30, m: E.STONE },
    { t: 'p', x: 20, y: 20, r: 0, m: E.BRINE },
    { t: 'p', x: 239, y: 31, r: 0, m: E.WATER },
  ] }, ...color);
  const w = engine.inspect();
  const prior = w.cells.slice();
  const keeper = 20 * E.W + 20;
  engine.tick({ paused: true, ops: [{ t: 'p', x: 240, y: 30, r: 1, m: E.SALT, mark: 1 }] }, ...color);
  simulateMs(engine, 600, color);
  assert.ok(countMat(w.cells, E.BRINE) > 1, 'some of the dab turned to brine');
  assert.equal(w.cells[keeper], E.BRINE);
  const foot = strokeFootprint(prior, 240, 30, 1);
  engine.tick({ paused: true, ops: [{ t: 'revert', m: E.SALT, ...foot }] }, ...color);
  assert.equal(countMat(w.cells, E.SALT), 0, 'no salt from the dab remains');
  assert.equal(countMat(w.cells, E.BRINE), 1, 'only the sealed brine remains');
  assert.equal(w.cells[keeper], E.BRINE);
});
