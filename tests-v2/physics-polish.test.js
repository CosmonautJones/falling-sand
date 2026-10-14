import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import * as E from '../public/v2/alembic-engine-v2.js';

const buffers = () => Array.from({ length: 3 }, () => new Uint8Array(E.N * 4));
const fingerprint = state => createHash('sha256').update(JSON.stringify(state, (_, value) =>
  ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') : value
)).digest('hex');
const count = (sim, material) => sim.cells.reduce((sum, cell) => sum + (cell === material), 0);

test('fast particles respect thin walls in both directions and conserve material', () => {
  for (const speed of [7, 16, 32, 1000]) for (const direction of [-1, 1]) for (const distance of [1, 3, 17]) {
    const world = E.createWorld({ seed: 73, scene: 'empty', weather: false, ambientEmbers: false });
    const sim = world.inspect(), wall = 240, x = wall - direction * distance, y = 100;
    for (let row = 0; row < E.H; row++) sim.setc(wall, row, E.STONE, 0);
    sim.setc(x, y, E.SAND, 0); sim.VX[y * E.W + x] = direction * speed;
    world.advanceTicks(1);
    const positions = Array.from(sim.cells.entries()).filter(([, m]) => m === E.SAND).map(([i]) => i % E.W);
    assert.equal(count(sim, E.STONE), E.H);
    assert.equal(positions.length, 1);
    assert.ok(positions.every(px => direction * (px - wall) < 0), `speed=${speed}, direction=${direction}, distance=${distance}`);
  }
});

test('extreme finite velocities terminate at world boundaries without losing a particle', () => {
  for (const direction of [-1, 1]) {
    const world = E.createWorld({ seed: 73, scene: 'empty', weather: false, ambientEmbers: false });
    const sim = world.inspect(), x = 240, y = 130;
    sim.setc(x, y, E.SAND, 0); sim.VX[y * E.W + x] = direction * 1e6; sim.VY[y * E.W + x] = -1e6;
    world.advanceTicks(1);
    assert.equal(count(sim, E.SAND), 1);
    assert.ok(sim.VX.every(Number.isFinite) && sim.VY.every(Number.isFinite));
  }
});

test('unsafe restored velocities reject atomically while normal blast velocities remain accepted', () => {
  const engine = E.createEngine({ seed: 73, scene: 'empty', weather: false });
  const before = fingerprint(engine.captureState());
  for (const field of ['VX', 'VY']) for (const velocity of [-1e30, -1000001, 1000001, 1e30]) {
    const checkpoint = engine.checkpoint(); checkpoint.state[field][100] = velocity;
    assert.throws(() => engine.restore(checkpoint), /velocity/i);
    assert.equal(fingerprint(engine.captureState()), before);
  }
  const checkpoint = engine.checkpoint(); checkpoint.state.VX[100] = 1000;
  assert.doesNotThrow(() => engine.restore(checkpoint));
});

test('equal wall time advances equal fixed ticks at 15/30/60/144 Hz and 1x/2x', () => {
  for (const hz of [15, 30, 60, 144]) for (const speed of [1, 2]) {
    const engine = E.createEngine({ seed: 73, scene: 'empty', weather: false, ambientEmbers: false });
    const planes = buffers();
    for (let frame = 0; frame < hz * 2; frame++) engine.tick({ dt: 1000 / hz, speed }, ...planes);
    assert.equal(engine.captureState().tickIndex, 120 * speed, `${hz} Hz at ${speed}x`);
  }
});

test('held tools produce the same full state at equal simulation time across frame schedules', () => {
  for (const held of [{ t: 'p', x: 100, y: 50, r: 2, m: E.SAND }, { t: 'spray', x: 100, y: 50, r: 3, m: E.SAND, n: 5 }]) {
    const states = [];
    for (const hz of [15, 30, 60, 144]) {
      const engine = E.createEngine({ seed: 73, scene: 'empty', weather: false, ambientEmbers: false });
      const planes = buffers();
      for (let frame = 0; frame < hz; frame++) engine.tick({ dt: 1000 / hz, held }, ...planes);
      assert.ok(count(engine.inspect(), E.SAND) > 0);
      states.push(fingerprint(engine.captureState()));
    }
    assert.ok(states.every(state => state === states[0]), held.t);
  }
});

test('held fling decay crosses its cutoff on the same tick in every frame schedule', () => {
  const states = [];
  for (const hz of [15, 30, 60, 144]) {
    const engine = E.createEngine({ seed: 73, scene: 'empty', weather: false, ambientEmbers: false });
    const planes = buffers(); let vx = 2;
    for (let frame = 0; frame < hz; frame++) {
      const held = { t: 'p', x: 100, y: 50, r: 2, m: E.SAND, ...(Math.abs(vx) >= 0.5 ? { vx } : {}) };
      const result = engine.tick({ dt: 1000 / hz, held }, ...planes);
      vx *= 0.85 ** result.steps;
    }
    assert.equal(engine.captureState().tickIndex, 60);
    states.push(fingerprint(engine.captureState()));
  }
  assert.ok(states.every(state => state === states[0]), 'same fading fling yields an identical complete checkpoint');
});

test('held-tool validation precedes all edits, advancement and random consumption', () => {
  const engine = E.createEngine({ seed: 73, scene: 'empty', weather: false });
  const before = fingerprint(engine.captureState());
  assert.throws(() => engine.tick({ dt: 100, ops: [{ t: 'p', x: 100, y: 50, r: 1, m: E.SAND }], held: { t: 'clear' } }, ...buffers()));
  assert.equal(fingerprint(engine.captureState()), before);
});

test('catch-up retains its bounded backlog and pause/step clears stale fractions', () => {
  const engine = E.createEngine({ seed: 73, scene: 'empty', weather: false });
  const planes = buffers();
  assert.equal(engine.tick({ dt: 1000 }, ...planes).discardedMs, 750);
  assert.equal(engine.captureState().tickIndex, 8);
  engine.tick({ dt: 0 }, ...planes);
  assert.equal(engine.captureState().tickIndex, 15, 'remaining seven ticks catch up');
  engine.tick({ dt: 8 }, ...planes);
  engine.tick({ paused: true, step: 1 }, ...planes);
  engine.tick({ dt: 9 }, ...planes);
  assert.equal(engine.captureState().tickIndex, 16, 'stale fractional time does not resume');
});

test('paused held tools do not edit until a tick is explicitly stepped', () => {
  const engine = E.createEngine({ seed: 73, scene: 'empty', weather: false });
  const held = { t: 'p', x: 100, y: 50, r: 2, m: E.SAND }, planes = buffers();
  engine.tick({ paused: true, held }, ...planes);
  assert.equal(count(engine.inspect(), E.SAND), 0);
  engine.tick({ paused: true, held, step: 1 }, ...planes);
  assert.ok(count(engine.inspect(), E.SAND) > 0);
});

test('all per-tick input batches validate before queued commands or state mutate', () => {
  const world = E.createWorld({ seed: 73, scene: 'empty', weather: false });
  const before = fingerprint(world.captureState());
  assert.throws(() => world.advanceTicks(2, [{ tick: 1, sequence: 0, op: { t: 'clear' } }], undefined,
    [[{ t: 'p', x: 100, y: 50, r: 1, m: E.SAND }], [{ t: 'clear' }]]));
  assert.equal(fingerprint(world.captureState()), before);
  assert.throws(() => world.advanceTicks(2, [], undefined, Array(2)));
  assert.equal(fingerprint(world.captureState()), before);
});

test('pointer fling response uses elapsed time and held descriptors do not enqueue frame edits', () => {
  const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  const context = { DCLogic: class { constructor() { this.props = {}; } },
    React: { createRef: () => ({ current: null }) }, performance: { now: () => 0 },
    localStorage: { getItem: () => null }, requestAnimationFrame: () => 1, Float32Array };
  vm.createContext(context); vm.runInContext(script + '\nthis.Component = Component;', context);
  const velocities = [];
  for (const hz of [20, 60, 120]) {
    const ui = new context.Component();
    for (let i = 0; i < hz / 5; i++) ui.trackFling(90 / hz, -30 / hz, 1000 / hz);
    velocities.push(ui.flingV);
    ui.painting = true; ui.curCell = { x: 100, y: 50 }; ui.state.tool = 'pour';
    assert.equal(ui.toolTick().t, 'p');
    assert.equal(ui.ops.length, 0, 'holding is described separately from explicit pointer edits');
  }
  for (const v of velocities) {
    assert.ok(Math.abs(v.x - velocities[0].x) < 1e-9);
    assert.ok(Math.abs(v.y - velocities[0].y) < 1e-9);
  }
});

test('worker transport and local adapter produce identical held-input continuation', async () => {
  // Exercise the browser worker entrypoint with Node's real transferable-buffer transport.
  const worker = new Worker(`
    const {parentPort, workerData} = require('node:worker_threads');
    global.WorkerGlobalScope = class {};
    global.self = new WorkerGlobalScope();
    self.postMessage = (message, transfer) => parentPort.postMessage(message, transfer);
    import(workerData).then(() => {
      parentPort.on('message', data => self.onmessage({data}));
      parentPort.postMessage({type: 'ready'});
    });
  `, { eval: true, workerData: new URL('../public/v2/alembic-engine-v2.js', import.meta.url).href });
  try {
    await once(worker, 'message');
    const local = E.createEngine();
    const request = async (message, transfer = []) => {
      const reply = once(worker, 'message'); worker.postMessage(message, transfer);
      return (await reply)[0];
    };
    assert.equal((await request({ t: 'restore', requestId: 1, checkpoint: local.checkpoint() })).ok, true);
    for (const msg of [{ dt: 0 }, { dt: 1000 / 144 }, { dt: 1000 / 15 }, { dt: 1000 / 30, speed: 2 }, { paused: true }, { paused: true, step: 3 }]) {
      const held = { t: 'p', x: 100, y: 50, r: 2, m: E.SAND, vx: 2 }, planes = buffers();
      const expected = local.tick({ ...msg, held }, ...planes);
      const color = new ArrayBuffer(E.N * 4), emis = new ArrayBuffer(E.N * 4), fx = new ArrayBuffer(E.N * 4);
      const actual = await request({ type: 'tick', ...msg, held, color, emis, fx }, [color, emis, fx]);
      assert.equal(color.byteLength, 0, 'send buffer ownership transfers to worker');
      assert.equal(actual.steps, expected.steps);
      assert.deepEqual(actual.events, expected.events);
      assert.deepEqual(new Uint8Array(actual.color), planes[0]);
    }
    const saved = await request({ t: 'checkpoint', requestId: 2 });
    assert.equal(saved.ok, true);
    assert.equal(fingerprint(saved.checkpoint.state), fingerprint(local.captureState()));
  } finally { await worker.terminate(); }
});

test('moving touch wands do not duplicate continuous tools on every pointer event', () => {
  const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  const surface = { addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: E.W, height: E.H }) };
  const context = { DCLogic: class { constructor() { this.props = {}; } },
    React: { createRef: () => ({ current: null }) }, performance: { now: () => 0 },
    localStorage: { getItem: () => null }, requestAnimationFrame: () => 1, Float32Array,
    window: surface, clearTimeout() {} };
  vm.createContext(context); vm.runInContext(script + '\nthis.Component = Component;', context);
  for (const tool of ['spray', 'heat', 'cool']) {
    const ui = new context.Component(); let callbacks;
    ui.M = E; ui.vpRef.current = surface; ui.vw = E.W; ui.vh = E.H;
    ui.touchMod = { createTouchPour(options) { callbacks = options; return {}; } };
    ui.bindInput(); ui.state.tool = tool;
    callbacks.pour(100, 50); callbacks.pour(101, 50); callbacks.pour(102, 50);
    assert.equal(ui.ops.length, 1, `${tool} initial dab only`);
    assert.equal(ui.toolTick().t, tool, 'continued use is described once per committed tick');
    ui.state.paused = true; callbacks.pour(103, 50);
    assert.equal(ui.ops.length, 2, 'explicit paused drag edits remain available');
  }
});
