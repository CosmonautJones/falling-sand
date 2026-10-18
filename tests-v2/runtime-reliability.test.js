import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Worker as ThreadWorker } from 'node:worker_threads';
import * as E from '../public/v2/alembic-engine-v2.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
const marker = (40 * E.W + 20) * 4 + 3;
const markerOps = () => [{ t: 'clear' }, { t: 'box', x0: 20, y0: 40, x1: 22, y1: 42, m: E.GLASS }];
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out waiting for ' + label)), 5000);
    })]);
  } finally { clearTimeout(timer); }
}

function component(t, withModule = true) {
  const values = new Map([['prior-flask', 'keep this saved checkpoint']]);
  const store = { writes: 0, getItem: key => values.get(key) ?? null,
    setItem(key, value) { this.writes++; values.set(key, value); } };
  const timers = new Map();
  let timerId = 0;
  const context = {
    DCLogic: class { constructor() { this.props = {}; } setState(value) { Object.assign(this.state, value); } },
    React: { createRef: () => ({ current: null }) }, localStorage: store, performance, console,
    Uint8Array, Float32Array, ArrayBuffer, Blob, Response, btoa, atob, URL,
    location: { href: 'https://example.test/v2/', hash: '' }, navigator: {},
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id), cancelAnimationFrame() {},
  };
  vm.createContext(context);
  vm.runInContext(script + '\nthis.Component = Component;', context);
  const ui = new context.Component();
  const creations = [];
  if (withModule) {
    ui.M = { ...E, createEngine(options) {
      const engine = E.createEngine(options);
      // VM UI objects cross a realm boundary that the browser UI/modules do not.
      const tick = engine.tick;
      engine.tick = (message, ...output) => tick(structuredClone(message), ...output);
      creations.push(engine);
      return engine;
    } };
    ui.known = new Set(E.STARTER);
  }
  ui.url = new URL('../public/v2/alembic-engine-v2.js', import.meta.url).href;
  ui.alive = true;
  ui.bufs = Array.from({ length: 3 }, () => new ArrayBuffer(E.N * 4));
  ui.ids = new Uint8Array(E.N);
  ui.lastColor = new Uint8Array(E.N * 4);
  ui.have = true;
  ui.upload = () => {}; // Only graphics upload is unavailable in this Node harness.
  ui.state.paused = true;
  t.after(() => ui.componentWillUnmount());
  return { ui, context, store, creations, timers };
}

// Fault controls exist only in this bridge around the actual browser worker entrypoint.
function bridge(t, context) {
  const instances = [];
  const engineURL = new URL('../public/v2/alembic-engine-v2.js', import.meta.url).href;
  const bootstrap = [
    "import { parentPort } from 'node:worker_threads';",
    'globalThis.WorkerGlobalScope = class {};',
    'globalThis.self = new WorkerGlobalScope();',
    'let failBeforeReply = false, holdCheckpoints = false;',
    'self.postMessage = (data, transfers) => {',
    "  if (failBeforeReply && data.type === 'frame') {",
    "    parentPort.postMessage({ __test: 'suppressed', marker: new Uint8Array(data.color)[" + marker + '] });',
    "    throw new Error('Injected failure after mutation, before first reply');",
    '  }',
    '  parentPort.postMessage(data, transfers);',
    '};',
    'await import(' + JSON.stringify(engineURL) + ');',
    "parentPort.on('message', data => {",
    "  if (data.__test === 'fail') throw new Error('Injected runtime worker failure');",
    "  if (data.__test === 'before-reply') { failBeforeReply = true; parentPort.postMessage({ __test: 'armed' }); return; }",
    "  if (data.__test === 'hold') { holdCheckpoints = true; parentPort.postMessage({ __test: 'holding' }); return; }",
    "  if (holdCheckpoints && (data.t === 'checkpoint' || data.t === 'restore')) { parentPort.postMessage({ __test: 'held', requestId: data.requestId }); return; }",
    '  self.onmessage({ data });',
    '});',
    "parentPort.postMessage({ __test: 'ready' });",
  ].join('\n');
  context.Worker = class {
    constructor() {
      this.ready = deferred(); this.failed = deferred();
      this.frames = []; this.frameWaiters = [];
      this.notices = new Map(); this.noticeWaiters = new Map();
      this.sent = 0;
      this.thread = new ThreadWorker(new URL('data:text/javascript,' + encodeURIComponent(bootstrap)));
      this.thread.on('message', data => {
        if (data.__test) {
          if (data.__test === 'ready') this.ready.resolve();
          else if (this.noticeWaiters.has(data.__test)) {
            this.noticeWaiters.get(data.__test).resolve(data); this.noticeWaiters.delete(data.__test);
          } else this.notices.set(data.__test, data);
          return;
        }
        try { this.onmessage?.({ data }); } catch (error) { this.callbackError = error; }
        if (data.type === 'frame') {
          if (this.frameWaiters.length) this.frameWaiters.shift().resolve(data);
          else this.frames.push(data);
        }
      });
      this.thread.on('error', error => {
        try { this.onerror?.({ message: error.message, error, preventDefault() {} }); }
        catch (callbackError) { this.callbackError = callbackError; }
        this.failed.resolve(error);
      });
      instances.push(this);
    }
    postMessage(data, transfers) { this.sent++; this.thread.postMessage(data, transfers); }
    terminate() { this.terminated = true; this.termination ??= this.thread.terminate(); }
    nextFrame() {
      if (this.frames.length) return Promise.resolve(this.frames.shift());
      const waiter = deferred(); this.frameWaiters.push(waiter);
      return bounded(waiter.promise, 'worker frame');
    }
    notice(name) {
      if (this.notices.has(name)) {
        const value = this.notices.get(name); this.notices.delete(name); return Promise.resolve(value);
      }
      const waiter = deferred(); this.noticeWaiters.set(name, waiter);
      return bounded(waiter.promise, name);
    }
    async control(name, acknowledgement) {
      this.thread.postMessage({ __test: name });
      if (acknowledgement) return this.notice(acknowledgement);
    }
    async fail() {
      this.thread.postMessage({ __test: 'fail' });
      return bounded(this.failed.promise, 'worker error');
    }
  };
  t.after(async () => {
    for (const worker of instances) { worker.terminate(); await worker.termination; }
  });
  return instances;
}

function stopped(ui, creations) {
  assert.equal(creations.length, 0, 'failure must not instantiate a replacement world');
  assert.equal(ui.have, false, 'the stopped engine cannot submit another frame');
  assert.equal(ui.state.paused, true, 'failure pauses the simulation');
  assert.equal(typeof ui.renderVals().engineError, 'string', 'failure has a persistent visible message');
  assert.match(ui.renderVals().engineError, /worker|simulation|engine/i);
}

test('initial render works before the engine module is available', t => {
  const { ui } = component(t, false);
  const tools = Array.from(ui.renderVals().tools, tool => tool.label);
  assert.ok(tools.includes('pour'));
  assert.ok(!tools.includes('tap'), 'tap waits for the engine and FONT discovery');
});

test('tap appears only after FONT is discovered', t => {
  const { ui } = component(t);
  assert.ok(!Array.from(ui.renderVals().tools, tool => tool.label).includes('tap'));
  ui.known.add(E.FONT);
  assert.ok(Array.from(ui.renderVals().tools, tool => tool.label).includes('tap'));
});

test('worker constructor failure still uses a functional local engine', t => {
  const { ui, context, creations } = component(t);
  context.Worker = class { constructor() { throw new Error('Worker unsupported'); } };
  ui.initEngine();
  assert.equal(ui.mode, 'local');
  assert.equal(creations.length, 1);
  ui.ops.push(...markerOps()); ui.send();
  assert.equal(ui.lastColor[marker], E.GLASS, 'local fallback commits the actual paint operation');
  assert.ok(!ui.renderVals().engineError);
});

test('a real worker runtime error stops without replacing its painted world', async t => {
  const { ui, context, store, creations } = component(t);
  const instances = bridge(t, context);
  ui.initEngine();
  const worker = instances[0];
  await bounded(worker.ready.promise, 'worker ready');
  ui.ops.push(...markerOps()); ui.send();
  const frame = await worker.nextFrame();
  assert.equal(worker.callbackError, undefined);
  assert.equal(ui.lastColor[marker], E.GLASS);
  assert.equal(ui.workerOk, true);
  const pixels = ui.lastColor.slice();
  const onMessage = worker.onmessage;
  ui.state.paused = false;
  await worker.fail();
  assert.equal(worker.callbackError, undefined);
  stopped(ui, creations);
  assert.equal(worker.terminated, true);
  assert.deepEqual(ui.lastColor, pixels, 'the last displayed world survives the fault');
  assert.equal(store.writes, 0);
  assert.equal(store.getItem('prior-flask'), 'keep this saved checkpoint');

  const sent = worker.sent;
  ui.ops.push({ t: 'p', x: 20, y: 40, r: 0, m: E.WATER });
  assert.doesNotThrow(() => ui.send());
  assert.equal(worker.sent, sent, 'explicit sends cannot restart a failed engine');
  const late = structuredClone(frame);
  new Uint8Array(late.color)[marker] = E.WATER;
  onMessage({ data: late });
  assert.deepEqual(ui.lastColor, pixels, 'a queued callback cannot repaint after failure');
  assert.equal(ui.have, false, 'a late frame cannot resume submissions');
});

test('a fault after submission before its first reply cannot reset the world', async t => {
  const { ui, context, creations } = component(t);
  const instances = bridge(t, context);
  ui.initEngine();
  const worker = instances[0];
  await bounded(worker.ready.promise, 'worker ready');
  await worker.control('before-reply', 'armed');
  const suppressed = worker.notice('suppressed');
  ui.ops.push(...markerOps()); ui.send();
  ui.state.paused = false;
  assert.equal((await suppressed).marker, E.GLASS, 'the real worker committed edits before failing');
  await bounded(worker.failed.promise, 'worker error');
  assert.equal(worker.callbackError, undefined);
  assert.ok(!ui.workerOk, 'no frame has been acknowledged');
  stopped(ui, creations);
});

test('a worker fault rejects in-flight checkpoints and ignores late replies', async t => {
  const { ui, context, creations } = component(t);
  const instances = bridge(t, context);
  ui.initEngine();
  const worker = instances[0];
  await bounded(worker.ready.promise, 'worker ready');
  ui.ops.push(...markerOps()); ui.send();
  await worker.nextFrame();
  await worker.control('hold', 'holding');
  const requestId = ui.requestCheckpoint('checkpoint', {}, { kind: 'export' });
  const held = worker.notice('held');
  ui.send();
  await worker.nextFrame();
  assert.equal((await held).requestId, requestId);
  assert.equal(ui.checkpointJobs.size, 1);
  const onMessage = worker.onmessage;
  ui.state.paused = false;
  await worker.fail();
  assert.equal(worker.callbackError, undefined);
  assert.equal(ui.checkpointJobs.size, 0);
  assert.equal(ui.checkpointRequests.length, 0);
  assert.equal(ui.state.flaskBusy, false);
  assert.match(ui.state.flaskStatus, /failed|unavailable/i);
  stopped(ui, creations);
  const status = ui.state.flaskStatus;
  onMessage({ data: { t: 'checkpoint', requestId, ok: true } });
  assert.equal(ui.state.flaskStatus, status, 'late success cannot replace the reported failure');
  assert.equal(ui.checkpointJobs.size, 0);
});

test('checkpoint imports after failure release the flask controls without writing storage', async t => {
  const { ui, store, creations } = component(t);
  ui.flaskStorage = await import('../public/v2/engine/flask-storage.js');
  const checkpoint = E.createEngine({ scene: 'empty', weather: false, ambientEmbers: false }).checkpoint();
  const text = ui.flaskStorage.checkpointText(checkpoint);
  ui.mode = 'worker'; ui.workerSubmitted = true; ui.toLocal();
  const input = { value: 'checkpoint.json', files: [{ size: text.length, text: async () => text }] };
  await ui.importCheckpoint({ target: input });
  stopped(ui, creations);
  assert.equal(ui.state.flaskBusy, false, 'a refused import must not leave the controls busy');
  assert.equal(ui.checkpointJobs.size, 0);
  assert.equal(ui.checkpointRequests.length, 0);
  assert.equal(store.writes, 0);
  assert.equal(input.value, '');
  assert.match(ui.state.flaskStatus, /reload/i);
});
