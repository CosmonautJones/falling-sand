import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { deflateRawSync } from 'node:zlib';
import * as E from '../public/v2/alembic-engine-v2.js';

let F = {};
try { F = await import('../public/v2/engine/flask-storage.js'); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
const need = name => assert.equal(typeof F[name], 'function', `${name} exposes flask persistence`);
const buffers = () => Array.from({ length: 3 }, () => new Uint8Array(E.N * 4));
function storage() {
  const values = new Map();
  return { writes: 0, fail: false, readError: null, getItem(key) { if (this.readError) throw this.readError; return values.get(key) ?? null; },
    setItem(key, value) { this.writes++; if (this.fail) throw new DOMException('Storage full', 'QuotaExceededError'); values.set(key, value); } };
}
function component(store = storage()) {
  const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  const context = { DCLogic: class { constructor() { this.props = {}; } setState(value) { Object.assign(this.state, value); } }, React: { createRef: () => ({ current: null }) },
    localStorage: store, performance, setTimeout, clearTimeout, console, Uint8Array, Float32Array, btoa, atob, Blob, Response, CompressionStream, DecompressionStream, location: { href: 'https://example.test/v2/', hash: '' }, navigator: {} };
  vm.createContext(context); vm.runInContext(script + '\nthis.Component = Component;', context);
  const ui = new context.Component(); ui.M = E; ui.flaskStorage = F; ui.eng = E.createEngine({ seed: 17, scene: 'empty' }); ui.mode = 'local';
  // UI literals come from a separate VM realm; the browser's UI and local module share one.
  // Copy across this test-only realm boundary while retaining the real engine implementation.
  const tick = ui.eng.tick; ui.eng.tick = (message, ...output) => tick(structuredClone(message), ...output);
  return { ui, store, context };
}

// A lossy cells-only migration must still load the old RLE data with original material positions.
test('legacy_flask_remains_loadable', () => {
  need('readFlasks'); need('decodeFlask');
  const store = storage(), cells = new Uint8Array(E.N); cells[17 * E.W + 20] = E.SAND;
  const entry = { t: 1234, thumb: 'data:image/png;base64,AA==', data: Buffer.from(E.rleEncode(cells)).toString('base64') };
  store.setItem('flasks', JSON.stringify([entry, null, null]));
  const loaded = F.decodeFlask(F.readFlasks(store, 'flasks')[0]);
  assert.equal(loaded.kind, 'scene-stamp'); assert.deepEqual(loaded.cells, cells);
  const engine = E.createEngine({ scene: 'empty' }); engine.tick({ paused: true, ops: [{ t: 'load', cells: loaded.cells }] }, ...buffers());
  assert.deepEqual(engine.captureState().cells, cells);
  F.saveFlask(store, 'flasks', 1, { kind: 'checkpoint-v1', checkpoint: engine.checkpoint(), t: 5678, thumb: '' });
  const migrated = F.readFlasks(store, 'flasks');
  assert.deepEqual(migrated[0], entry); assert.deepEqual(F.decodeFlask(migrated[0]).cells, cells);
});

// Missing velocity, heat, shades, PRNG or queued commands changes future world evolution.
test('new_flask_restores_moving_world', () => {
  need('saveFlask'); need('decodeFlask');
  const engine = E.createEngine({ seed: 71, scene: 'empty' });
  engine.advanceTicks(9, [{ tick: 1, sequence: 0, op: { t: 'p', x: 100, y: 40, r: 5, m: E.SAND, vx: 3, vy: -1 } },
    { tick: 15, sequence: 0, op: { t: 'heat', x: 100, y: 50, r: 5 } }]);
  const checkpoint = engine.checkpoint(), store = storage();
  const entries = F.saveFlask(store, 'flasks', 1, { kind: 'checkpoint-v1', checkpoint, t: 4567, thumb: 'data:image/png;base64,AA==' });
  assert.equal(store.writes, 1); assert.equal(entries[1].kind, 'checkpoint-v1'); assert.equal(entries[1].t, 4567);
  assert.equal(entries[1].thumb, 'data:image/png;base64,AA==');
  engine.advanceTicks(40); const expected = engine.captureState();
  const decoded = F.decodeFlask(F.readFlasks(store, 'flasks')[1]);
  const restored = E.createEngine({ seed: 2, scene: 'vessel' }); restored.restore(decoded.checkpoint);
  assert.deepEqual(restored.captureState(), checkpoint.state);
  restored.advanceTicks(40); assert.deepEqual(restored.captureState(), expected);
});

// A quota failure must not delete, overwrite or publish a replacement for the prior save.
test('quota_failure_preserves_previous_save', () => {
  need('saveFlask');
  const store = storage(); store.setItem('flasks', JSON.stringify([null, { t: 123, thumb: '', data: Buffer.from(E.rleEncode(new Uint8Array(E.N))).toString('base64') }, null]));
  const previous = store.getItem('flasks'); store.writes = 0; store.fail = true;
  assert.throws(() => F.saveFlask(store, 'flasks', 1, { kind: 'checkpoint-v1', checkpoint: E.createEngine().checkpoint(), t: 456, thumb: '' }), { name: 'QuotaExceededError' });
  assert.equal(store.writes, 1); assert.equal(store.getItem('flasks'), previous);
});

// Unknown versions/kinds and broken payloads must fail without requesting mutation.
test('malformed_flask_reports_error', () => {
  need('decodeFlask'); need('parseCheckpointText');
  for (const value of [null, { kind: 'checkpoint-v2' }, { data: '!!!' }, { data: 'AAA=' }, { kind: 'checkpoint-v1', data: { version: 2 } }]) assert.throws(() => F.decodeFlask(value));
  assert.throws(() => F.parseCheckpointText('{'), /JSON|Unexpected|property/i);
  const encoded = E.encodeCheckpoint(E.createEngine().checkpoint()); encoded.version = 2;
  assert.throws(() => F.parseCheckpointText(JSON.stringify(encoded)), /version/);
  // Invalid JSON is intentional: size must win over JSON.parse, including whitespace/UTF-8.
  assert.throws(() => F.parseCheckpointText(' '.repeat(E.MAX_CHECKPOINT_BYTES + 1)), /16 MiB/);
  assert.throws(() => F.parseCheckpointText('é'.repeat(E.MAX_CHECKPOINT_BYTES / 2 + 1)), /16 MiB/);
});

// Real success and error replies must remove the pending job and release the controls.
test('restore_response_clears_pending_ui', () => {
  assert.equal(typeof E.handleEngineRequest, 'function', 'shared worker/local request handler');
  const { ui } = component(); assert.equal(typeof ui.onCheckpointReply, 'function');
  for (const invalid of [false, true]) {
    const checkpoint = ui.eng.checkpoint(); if (invalid) checkpoint.version = 2;
    const before = ui.eng.captureState();
    const requestId = ui.requestCheckpoint('restore', { checkpoint }, { kind: 'restore' });
    assert.equal(ui.state.flaskBusy, true);
    const reply = E.handleEngineRequest(ui.eng, { t: 'restore', checkpoint, requestId });
    ui.onCheckpointReply(reply);
    assert.equal(ui.checkpointJobs.size, 0); assert.equal(ui.state.flaskBusy, false);
    assert.match(ui.state.flaskStatus, invalid ? /failed/i : /restored/i);
    assert.deepEqual(ui.eng.captureState(), before);
  }
});

// Quota feedback must retain the old UI entry and offer the actual full checkpoint file.
test('save_failure_offers_complete_download_without_changing_flask', () => {
  assert.equal(typeof E.handleEngineRequest, 'function'); need('parseCheckpointText');
  const { ui, store } = component();
  ui.state.flasks[0] = { t: 123, thumb: '', data: Buffer.from(E.rleEncode(new Uint8Array(E.N))).toString('base64') };
  store.setItem('alembic-flasks-v2', JSON.stringify(ui.state.flasks)); store.fail = true;
  const before = JSON.stringify(ui.state.flasks);
  const requestId = ui.requestCheckpoint('checkpoint', {}, { kind: 'save', slot: 0, thumb: '' });
  ui.onCheckpointReply(E.handleEngineRequest(ui.eng, { t: 'checkpoint', requestId }));
  assert.equal(JSON.stringify(ui.state.flasks), before); assert.equal(ui.state.flaskBusy, false);
  assert.match(ui.state.flaskStatus, /failed|could not save/i);
  assert.deepEqual(F.parseCheckpointText(ui.state.checkpointDownload), ui.eng.checkpoint());
});

// Checkpoint requests use detached full state; legacy snap/load still cross the tick adapter.
test('worker_protocol_preserves_checkpoint_and_legacy_stamps', () => {
  assert.equal(typeof E.handleEngineRequest, 'function');
  const engine = E.createEngine({ seed: 77, scene: 'empty' });
  const cells = new Uint8Array(E.N); cells[100] = E.WATER;
  const frame = engine.tick({ paused: true, ops: [{ t: 'load', cells }, { t: 'snap' }] }, ...buffers());
  assert.deepEqual(frame.snap.cells, cells);
  const reply = E.handleEngineRequest(engine, { t: 'checkpoint', requestId: 9 });
  assert.equal(reply.t, 'checkpoint'); assert.equal(reply.requestId, 9); assert.equal(reply.ok, true);
  reply.checkpoint.state.cells[100] = E.GOLD;
  assert.equal(engine.captureState().cells[100], E.WATER);
  assert.equal(E.handleEngineRequest(engine, { t: 'restore', checkpoint: reply.checkpoint, requestId: 10 }).ok, true);
  assert.equal(engine.captureState().cells[100], E.GOLD);
});

// Returned pixels must belong to the correlated capture, even if a newer frame renders later.
test('checkpoint_thumbnail_pixels_are_correlated_and_detached', () => {
  const engine = E.createEngine({ seed: 11, scene: 'empty' });
  engine.tick({ paused: true, ops: [{ t: 'p', x: 99, y: 39, r: 1, m: E.GLASS }] }, ...buffers());
  const before = engine.captureState();
  const reply = E.handleEngineRequest(engine, { t: 'checkpoint', requestId: 12, thumbnail: true });
  assert.equal(reply.ok, true); assert.equal(reply.requestId, 12);
  assert.ok(reply.color instanceof Uint8Array);
  assert.equal(reply.color[(39 * E.W + 99) * 4 + 3], E.GLASS);
  assert.deepEqual(engine.captureState(), before, 'thumbnail rendering never changes authoritative state');
  engine.tick({ paused: true, ops: [{ t: 'clear' }] }, ...buffers());
  assert.equal(reply.checkpoint.state.cells[39 * E.W + 99], E.GLASS);
  assert.equal(reply.color[(39 * E.W + 99) * 4 + 3], E.GLASS);
});

test('flask_thumbnail_uses_the_capture_after_pending_edits', () => {
  const { ui, store, context } = component();
  // The unavailable browser canvas API is replaced by an in-memory pixel canvas.
  context.document = { createElement() {
    const canvas = { width: 0, height: 0, pixels: null,
      getContext() { return {
        createImageData: (w, h) => ({ data: new Uint8Array(w * h * 4) }),
        putImageData: image => { canvas.pixels = image.data.slice(); },
        drawImage: source => {
          canvas.pixels = new Uint8Array(canvas.width * canvas.height * 4);
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            const i = (Math.floor(y * source.height / canvas.height) * source.width + Math.floor(x * source.width / canvas.width)) * 4;
            canvas.pixels.set(source.pixels.subarray(i, i + 4), (y * canvas.width + x) * 4);
          }
        },
      }; },
      toDataURL() { return 'data:image/png;base64,' + Buffer.from(canvas.pixels).toString('base64'); },
    }; return canvas;
  } };
  ui.bufs = buffers().map(b => b.buffer); ui.ids = new Uint8Array(E.N); ui.lastColor = new Uint8Array(E.N * 4);
  ui.upload = () => {}; ui.state.paused = true;
  ui.ops.push({ t: 'p', x: 99, y: 39, r: 1, m: E.GLASS });
  ui.saveFlask(0); ui.send();
  const entry = F.readFlasks(store, 'alembic-flasks-v2')[0];
  const saved = F.decodeFlask(entry).checkpoint;
  assert.equal(saved.state.cells[39 * E.W + 99], E.GLASS);
  const pixels = Buffer.from(entry.thumb.split(',')[1], 'base64'), offset = (13 * 160 + 33) * 4;
  const shade = saved.state.shades[39 * E.W + 99];
  assert.deepEqual([...pixels.subarray(offset, offset + 4)], [148 + shade, 206 + shade, 196 + shade, 255], 'thumbnail shows the painted glass rather than the earlier empty frame');
});

// Cached pixels must survive transferred buffers, so flask thumbnails show the saved vessel.
test('frame_retains_pixels_for_checkpoint_thumbnail', () => {
  const { ui } = component();
  ui.bufs = buffers().map(b => b.buffer); ui.ids = new Uint8Array(E.N); ui.lastColor = new Uint8Array(E.N * 4);
  ui.upload = () => {}; // Only WebGL upload is unavailable in this Node harness.
  ui.eng.inspect().setc(50, 60, E.SAND, 3);
  ui.eng.render(...ui.bufs.map(b => new Uint8Array(b)), 0);
  const expected = new Uint8Array(ui.bufs[0]).slice();
  ui.onFrame({ events: [] });
  assert.equal(ui.lastColor[(60 * E.W + 50) * 4 + 3], E.SAND);
  assert.equal(Buffer.from(ui.lastColor).equals(Buffer.from(expected)), true);
});

// Completing a reply must also discard its unsent request rather than replay it later.
test('reply_removes_unsent_request_and_ignores_duplicate_replies', () => {
  const { ui } = component();
  const requestId = ui.requestCheckpoint('restore', { checkpoint: ui.eng.checkpoint() }, { kind: 'restore' });
  ui.onCheckpointReply(E.handleEngineRequest(ui.eng, { t: 'restore', checkpoint: ui.eng.checkpoint(), requestId }));
  assert.equal(ui.checkpointRequests.length, 0);
  const status = ui.state.flaskStatus;
  ui.onCheckpointReply({ t: 'restore', requestId, ok: false, error: 'late error' });
  assert.equal(ui.state.flaskStatus, status);
});

// File size, raw text size and version failures must clear UI state before dispatch.
test('corrupt_import_never_requests_restore_and_releases_controls', async () => {
  const { ui } = component(); ui.alive = true;
  const encoded = E.encodeCheckpoint(ui.eng.checkpoint()); encoded.version = 2;
  for (const file of [
    { size: E.MAX_CHECKPOINT_BYTES + 1, text: () => { throw new Error('must not read oversized file'); } },
    new Blob([' '.repeat(E.MAX_CHECKPOINT_BYTES + 1)]), new Blob(['{']), new Blob([JSON.stringify(encoded)]),
  ]) {
    const input = { files: [file], value: 'chosen.json' };
    await ui.importCheckpoint({ target: input });
    assert.equal(ui.checkpointJobs.size, 0); assert.equal(ui.checkpointRequests.length, 0);
    assert.equal(ui.state.flaskBusy, false); assert.equal(input.value, '');
    assert.match(ui.state.flaskStatus, /import failed/i);
  }
  const input = { files: [new Blob([F.checkpointText(ui.eng.checkpoint())])], value: 'chosen.json' };
  await ui.importCheckpoint({ target: input });
  assert.equal(ui.state.flaskBusy, true); assert.equal(ui.checkpointRequests.length, 1);
  ui.onCheckpointReply(E.handleEngineRequest(ui.eng, ui.checkpointRequests[0]));
  assert.equal(ui.state.flaskBusy, false); assert.match(ui.state.flaskStatus, /restored/i);
});

// Both historical URL codecs and newly copied links remain cells-only scene stamps.
test('legacy_scene_share_links_remain_compatible', async () => {
  const { ui, context } = component();
  const cells = new Uint8Array(E.N); cells[37 * E.W + 20] = E.SAND; cells[100] = E.WATER;
  const rle = E.rleEncode(cells);
  for (const [tag, bytes] of [['r', rle], ['z', deflateRawSync(rle)]]) {
    context.location.hash = '#flask=' + tag + Buffer.from(bytes).toString('base64url');
    await ui.loadFromHash();
    assert.equal(ui.pending.length, 1); assert.deepEqual(ui.pending[0].cells, cells);
    assert.equal(ui.pending[0].t, 'wipe'); assert.equal(ui.pending[0].mode, 'load');
    assert.equal(ui.checkpointJobs.size, 0); assert.match(ui.state.flaskStatus, /scene stamp/i);
    ui.pending = [];
  }
  let copied = '';
  context.navigator.clipboard = { writeText: async text => { copied = text; } };
  for (const compressed of [false, true]) {
    context.CompressionStream = compressed ? CompressionStream : undefined;
    ui.snapJob = { kind: 'share' }; await ui.onSnap({ cells });
    assert.match(copied, compressed ? /#flask=z/ : /#flask=r/);
    context.location.hash = copied.slice(copied.indexOf('#'));
    await ui.loadFromHash(); assert.deepEqual(ui.pending[0].cells, cells); ui.pending = [];
  }
});

// Run the actual browser worker entrypoint with a Node bridge, not a fake engine.
test('real_worker_replies_and_survives_rejected_restore', async () => {
  const engineURL = new URL('../public/v2/alembic-engine-v2.js', import.meta.url).href;
  const bootstrap = `import { parentPort } from 'node:worker_threads';
    globalThis.WorkerGlobalScope = class {};
    globalThis.self = new WorkerGlobalScope();
    self.postMessage = (data, transfers) => parentPort.postMessage(data, transfers);
    await import(${JSON.stringify(engineURL)});
    parentPort.on('message', data => self.onmessage({ data }));
    parentPort.postMessage({ ready: true });`;
  const worker = new Worker(new URL('data:text/javascript,' + encodeURIComponent(bootstrap)));
  try {
    assert.equal((await once(worker, 'message'))[0].ready, true);
    async function request(data) { const reply = once(worker, 'message'); worker.postMessage(data); return (await reply)[0]; }
    const cells = new Uint8Array(E.N); cells[100] = E.WATER;
    const frame = await request({ type: 'tick', paused: true, ops: [{ t: 'load', cells }, { t: 'snap' }],
      color: new ArrayBuffer(E.N * 4), emis: new ArrayBuffer(E.N * 4), fx: new ArrayBuffer(E.N * 4) });
    assert.equal(frame.type, 'frame'); assert.deepEqual(frame.snap.cells, cells);
    const saved = await request({ t: 'checkpoint', requestId: 1, thumbnail: true });
    assert.equal(saved.ok, true); assert.equal(saved.requestId, 1); assert.equal(saved.checkpoint.state.cells[100], E.WATER);
    assert.equal(saved.color[100 * 4 + 3], E.WATER, 'real worker returns pixels from the correlated capture');
    const bad = structuredClone(saved.checkpoint); bad.version = 2;
    const failed = await request({ t: 'restore', checkpoint: bad, requestId: 2 });
    assert.equal(failed.ok, false); assert.match(failed.error, /version/); assert.equal(failed.requestId, 2);
    const after = await request({ t: 'checkpoint', requestId: 3 }); assert.deepEqual(after.checkpoint, saved.checkpoint);
    const restored = await request({ t: 'restore', checkpoint: saved.checkpoint, requestId: 4 }); assert.equal(restored.ok, true);
  } finally { await worker.terminate(); }
});

// The local browser path must flush edits, capture full state, and restore through its reply handler.
test('local_component_save_and_restore_use_the_real_engine', () => {
  const { ui, store } = component();
  ui.bufs = buffers().map(b => b.buffer); ui.ids = new Uint8Array(E.N); ui.lastColor = new Uint8Array(E.N * 4);
  ui.upload = () => {}; ui.state.paused = true;
  ui.ops.push({ t: 'p', x: 100, y: 40, r: 3, m: E.SAND, vx: 3, vy: -1 });
  ui.requestCheckpoint('checkpoint', {}, { kind: 'save', slot: 0, thumb: 'data:image/png;base64,AA==' }); ui.send();
  assert.equal(ui.state.flaskBusy, false); assert.match(ui.state.flaskStatus, /saved/i);
  const saved = F.decodeFlask(F.readFlasks(store, 'alembic-flasks-v2')[0]).checkpoint;
  assert.deepEqual(saved.state, ui.eng.captureState());
  ui.eng.advanceTicks(30);
  ui.loadFlask(0); assert.equal(ui.state.flaskBusy, true); ui.send();
  assert.equal(ui.state.flaskBusy, false); assert.match(ui.state.flaskStatus, /restored/i);
  assert.deepEqual(ui.eng.captureState(), saved.state);
});

// Disabled Storage reads must leave UI flasks untouched and allow an independent file download.
test('denied_storage_offers_checkpoint_download', () => {
  const { ui, store } = component(); store.readError = new DOMException('Storage denied', 'SecurityError');
  const requestId = ui.requestCheckpoint('checkpoint', {}, { kind: 'save', slot: 0, thumb: '' });
  ui.onCheckpointReply(E.handleEngineRequest(ui.eng, { t: 'checkpoint', requestId }));
  assert.equal(store.writes, 0); assert.equal(ui.state.flasks[0], null); assert.equal(ui.state.flaskBusy, false);
  assert.match(ui.state.flaskStatus, /could not save/i);
  assert.deepEqual(F.parseCheckpointText(ui.state.checkpointDownload), ui.eng.checkpoint());
});
