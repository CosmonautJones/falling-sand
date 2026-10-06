import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as E from '../public/v2/alembic-engine-v2.js';

const buffers = () => Array.from({ length: 3 }, () => new Uint8Array(E.N * 4));
const fingerprint = state => createHash('sha256').update(JSON.stringify(state, (_, value) =>
  ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') : value
)).digest('hex');
const sameState = (a, b, message) => assert.equal(fingerprint(a), fingerprint(b), message);
const scheduled = (tick, sequence, op) => ({ tick, sequence, op });
const box = (m, x0, y0, x1, y1) => ({ t: 'box', m, x0, y0, x1, y1 });
const eligible = () => [scheduled(1, 0, box(E.CLOUD, 50, 1, 149, 8)),
  scheduled(1, 1, box(E.GOLD, 200, 200, 219, 219))];

// Catches environmental clocks/wipes or event resets depending on presentation calls.
test('equal_ticks_ignore_render_batching', () => {
  const a = E.createEngine({ seed: 31, scene: 'vessel' });
  const b = E.createEngine({ seed: 31, scene: 'vessel' });
  assert.equal(typeof a.advanceTicks, 'function', 'explicit tick advancement exists');
  const commands = [...eligible(), scheduled(9, 0, { t: 'wipe', mode: 'clear' })];
  const events = a.advanceTicks(13, commands);
  const batchedEvents = [];
  b.advanceTicks(0, commands);
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < i % 4; j++) b.render(...buffers(), i * 4 + j);
    b.tick({ paused: true, dt: 200, speed: 4 }, ...buffers());
    batchedEvents.push(...b.advanceTicks(1));
  }
  assert.ok(events.some(e => e.t === 'storm'), 'weather-eligible census starts storm');
  assert.ok(events.some(e => e.t === 'ship'), 'gold-eligible census starts ship');
  assert.deepEqual(events, batchedEvents, 'events retain tick/sequence order across batches');
  assert.equal(a.captureState().tickIndex, 13);
  assert.equal(a.captureState().scanDir, -1, 'odd scan parity covered');
  assert.equal(a.captureState().wipe, 70, 'wipe advances once per committed tick');
  sameState(a.captureState(), b.captureState());
});

// Catches paused polls clearing events, decaying flash, progressing wipes or spawning weather.
test('paused_polling_has_no_world_effect', () => {
  const engine = E.createEngine({ seed: 19, scene: 'empty' });
  const result = engine.tick({ paused: true, dt: 0, speed: 1,
    ops: [box(E.CLOUD, 50, 1, 149, 8), box(E.GOLD, 200, 200, 219, 219),
      { t: 'tempest' }, { t: 'wipe', mode: 'clear' }] }, ...buffers());
  assert.ok(result.events.some(e => e.t === 'storm'), 'explicit paused edit is applied');
  const before = engine.captureState();
  for (let i = 0; i < 12; i++) engine.tick({ paused: true, dt: 900, speed: 10 }, ...buffers());
  sameState(engine.captureState(), before, 'polling changes no authoritative field');
  assert.equal(before.tickIndex, 0);
  assert.equal(before.wipe, 0, 'paused edit schedules, but does not progress, wipe');
});

// Catches enqueue order replacing sequence order, or commands running after physics.
test('commands_have_stable_order', () => {
  const a = E.createEngine({ seed: 11, scene: 'empty' });
  const b = E.createEngine({ seed: 11, scene: 'empty' });
  assert.equal(typeof a.advanceTicks, 'function');
  const commands = [scheduled(1, 3, box(E.SAND, 100, 50, 100, 50)),
    scheduled(1, 1, box(E.STONE, 100, 50, 100, 50)), scheduled(2, 0, { t: 'tempest' })];
  a.advanceTicks(0, commands);
  commands[0].op.m = E.GOLD;
  assert.equal(a.captureState().commands[1].op.m, E.SAND, 'queued inputs are detached and sorted');
  const capture = a.captureState(); capture.commands[0].op.m = E.GOLD;
  b.advanceTicks(0, [scheduled(2, 0, { t: 'tempest' }),
    scheduled(1, 1, box(E.STONE, 100, 50, 100, 50)), scheduled(1, 3, box(E.SAND, 100, 50, 100, 50))]);
  a.advanceTicks(1); b.advanceTicks(1);
  assert.equal(a.inspect().get(100, 50), E.AIR, 'ordered sand already moved in tick one');
  assert.ok(a.captureState().cells.some(m => m === E.SAND));
  sameState(a.captureState(), b.captureState());
  assert.deepEqual(a.advanceTicks(1), [{ t: 'storm' }]);
  assert.deepEqual(b.advanceTicks(1), [{ t: 'storm' }]);
  sameState(a.captureState(), b.captureState());
});

// Catches validation after partial enqueue/advance, including duplicates against pending work.
test('past_commands_rejected_atomically', () => {
  const engine = E.createEngine({ seed: 1, scene: 'empty' });
  assert.equal(typeof engine.advanceTicks, 'function');
  engine.advanceTicks(2, [scheduled(5, 7, { t: 'tempest' })]);
  for (const commands of [
    [scheduled(3, 0, { t: 'clear' }), scheduled(2, 1, { t: 'tempest' })],
    [scheduled(3, 0, { t: 'clear' }), scheduled(3, 0, { t: 'tempest' })],
    [scheduled(3, 0, { t: 'clear' }), scheduled(5, 7, { t: 'clear' })],
    [scheduled(3.5, 0, { t: 'clear' })], [scheduled(3, -1, { t: 'clear' })],
  ]) {
    const before = engine.captureState();
    assert.throws(() => engine.advanceTicks(1, commands), /tick|sequence/i);
    sameState(engine.captureState(), before, 'rejected batch leaves full world and queue unchanged');
  }
  for (const count of [-1, 0.5, NaN, Infinity]) {
    const before = engine.captureState();
    assert.throws(() => engine.advanceTicks(count), /count/i);
    sameState(engine.captureState(), before);
  }
});

// Catches reset retaining commands, environmental work, or host accumulator remainder.
test('reset_cancels_old_scheduled_events', () => {
  const engine = E.createEngine({ seed: 7, scene: 'empty' });
  assert.equal(typeof engine.advanceTicks, 'function');
  engine.advanceTicks(2, [...eligible(), scheduled(3, 0, { t: 'tempest' }),
    scheduled(3, 1, { t: 'wipe', mode: 'clear' })]);
  engine.tick({ dt: 10, speed: 1 }, ...buffers());
  engine.reset({ seed: 19, scene: 'empty' });
  const fresh = E.createEngine({ seed: 19, scene: 'empty' });
  sameState(engine.captureState(), fresh.captureState());
  engine.tick({ dt: 7, speed: 1 }, ...buffers());
  fresh.tick({ dt: 7, speed: 1 }, ...buffers());
  assert.equal(engine.captureState().tickIndex, 0, 'old remainder was cancelled');
  assert.deepEqual(engine.advanceTicks(7), []);
  fresh.advanceTicks(7);
  sameState(engine.captureState(), fresh.captureState());
});

// Catches unlimited catch-up or host overload altering deterministic world state.
test('legacy_catch_up_is_bounded_and_discarded_time_is_telemetry', () => {
  const a = E.createEngine({ seed: 1, scene: 'empty' });
  const b = E.createEngine({ seed: 1, scene: 'empty' });
  assert.equal(typeof b.advanceTicks, 'function');
  const result = a.tick({ dt: 200, speed: 10, ops: [{ t: 'tempest' }] }, ...buffers());
  const expected = b.advanceTicks(3, [scheduled(1, 0, { t: 'tempest' })]);
  assert.equal(a.captureState().tickIndex, 3);
  assert.equal(result.discardedMs, 1950, 'input clipping and abandoned backlog are reported');
  assert.deepEqual(result.events, expected);
  sameState(a.captureState(), b.captureState(), 'discarded time never advances environmental clocks');
});

// Catches edits being executed by an unpaused message before a tick can commit.
test('legacy_ops_wait_for_the_next_tick_and_merge_after_queued_commands', () => {
  const a = E.createEngine({ seed: 11, scene: 'empty' });
  const b = E.createEngine({ seed: 11, scene: 'empty' });
  const queued = scheduled(1, 0, box(E.STONE, 100, 50, 100, 50));
  a.advanceTicks(0, [queued]); b.advanceTicks(0, [queued]);
  const op = box(E.SAND, 100, 50, 100, 50);
  const poll = a.tick({ dt: 0, speed: 1, ops: [op] }, ...buffers());
  b.advanceTicks(0, [scheduled(1, 1, op)]);
  assert.deepEqual(poll.events, []);
  sameState(a.captureState(), b.captureState(), 'sub-tick message only queues its operation');
  a.tick({ dt: 1000 / 60, speed: 1 }, ...buffers()); b.advanceTicks(1);
  assert.equal(a.inspect().get(100, 50), E.AIR, 'adapter command runs before physics');
  sameState(a.captureState(), b.captureState());
});

// A later paused edit must not be overwritten by an older sub-tick input on resume.
test('paused_edit_reconciles_next_tick_commands_before_new_edits_without_advancing_time', () => {
  const engine = E.createEngine({ seed: 11, scene: 'empty' });
  const expected = E.createEngine({ seed: 11, scene: 'empty' });
  const later = scheduled(3, 0, { t: 'tempest' });
  engine.advanceTicks(0, [later]); expected.advanceTicks(0, [later]);
  const older = box(E.STONE, 100, 50, 100, 50), newer = box(E.GLASS, 100, 50, 100, 50);
  engine.tick({ dt: 8, speed: 1, ops: [older] }, ...buffers());
  const frame = engine.tick({ paused: true, dt: 900, speed: 10, ops: [newer, { t: 'snap' }] }, ...buffers());
  expected.tick({ paused: true, ops: [older, newer] }, ...buffers());
  assert.equal(frame.snap.cells[50 * E.W + 100], E.GLASS);
  sameState(engine.captureState(), expected.captureState(), 'edits retain order without a physics or environment tick');
  assert.deepEqual(engine.captureState().commands, [later], 'later-tick input remains scheduled');
  engine.tick({ dt: 9, speed: 1 }, ...buffers()); expected.advanceTicks(1);
  assert.equal(engine.inspect().get(100, 50), E.GLASS, 'resume cannot replay the older edit');
  sameState(engine.captureState(), expected.captureState());
});

// Intake must reject an entire malformed batch before applying any edit or consuming queued input.
test('malformed_command_payloads_are_rejected_atomically', () => {
  const malformed = [null, { t: 'unknown' }, { t: ['snap'] }, { t: 'p', x: 100, y: 50, r: 1 },
    { t: 'p', x: NaN, y: 50, r: 1, m: E.STONE }, { t: 'p', x: 100, y: 50, r: 1, m: E.COUNT },
    { t: 'p', x: 100, y: 50, r: 1, m: E.STONE, vx: Infinity },
    { t: 'load', cells: new Uint8Array(E.N - 1) }, { t: 'wipe', mode: 'load' }, { t: 'clear', extra: true }];
  for (const count of [0, 1]) for (const op of malformed) {
    const engine = E.createEngine({ seed: 11, scene: 'empty' });
    engine.advanceTicks(0, [scheduled(3, 0, { t: 'tempest' })]);
    const before = engine.captureState();
    assert.throws(() => engine.advanceTicks(count, [scheduled(1, 0, box(E.STONE, 100, 50, 100, 50)), scheduled(1, 1, op)]));
    sameState(engine.captureState(), before, 'invalid payload leaves cells, random streams, time, and queue intact');
    assert.doesNotThrow(() => E.encodeCheckpoint(engine.checkpoint()));
  }
  const engine = E.createEngine({ seed: 11, scene: 'empty' });
  engine.tick({ dt: 8, ops: [box(E.STONE, 100, 50, 100, 50)] }, ...buffers());
  const before = engine.captureState();
  assert.throws(() => engine.tick({ paused: true, ops: [box(E.GLASS, 100, 50, 100, 50), null] }, ...buffers()));
  sameState(engine.captureState(), before, 'invalid paused batch cannot consume pending input or partially paint');
  engine.tick({ dt: 9 }, ...buffers());
  assert.equal(engine.inspect().get(100, 50), E.STONE);
});

test('command_intake_rejects_accessors_without_reading_them', () => {
  const engine = E.createEngine({ scene: 'empty' });
  const before = engine.captureState();
  let reads = 0;
  const command = { sequence: 0, op: { t: 'clear' } };
  Object.defineProperty(command, 'tick', { enumerable: true, get() { reads++; return 1; } });
  assert.throws(() => engine.advanceTicks(1, [command]));
  assert.equal(reads, 0, 'intake inspects data descriptors before reading fields');
  sameState(engine.captureState(), before);
});

test('legacy_nonfinite_fling_hints_normalize_before_queueing_and_export', () => {
  const engine = E.createEngine({ scene: 'empty' });
  engine.tick({ dt: 8, ops: [{ t: 'p', x: 100, y: 50, r: 1, m: E.SAND, vx: NaN, vy: Infinity }] }, ...buffers());
  assert.deepEqual(engine.captureState().commands[0].op, { t: 'p', x: 100, y: 50, r: 1, m: E.SAND, vx: 0, vy: 0 });
  assert.doesNotThrow(() => E.encodeCheckpoint(engine.checkpoint()));
});

// Rejected intake must not spend the host's accumulated fractional tick either.
test('oversized_host_batch_does_not_consume_accumulated_time', () => {
  const engine = E.createEngine({ scene: 'empty' });
  engine.tick({ dt: 8 }, ...buffers());
  const before = engine.captureState();
  const ops = Array.from({ length: 85 }, () => ({ t: 'load', cells: new Uint8Array(E.N) }));
  assert.throws(() => engine.tick({ dt: 9, ops }, ...buffers()), /16 MiB/);
  sameState(engine.captureState(), before);
  engine.tick({ dt: 8 }, ...buffers());
  assert.equal(engine.captureState().tickIndex, 0, 'failed intake leaves the original eight milliseconds');
  engine.tick({ dt: 1 }, ...buffers());
  assert.equal(engine.captureState().tickIndex, 1);
});

// Catches moving legacy scene stamps after physics or losing request order on a tick batch.
test('legacy_snap_preserves_command_order_before_physics', () => {
  const engine = E.createEngine({ seed: 11, scene: 'empty' });
  const result = engine.tick({ dt: 1000 / 60, speed: 1,
    ops: [box(E.SAND, 100, 50, 100, 50), { t: 'snap' }] }, ...buffers());
  assert.equal(result.snap.cells[50 * E.W + 100], E.SAND);
  assert.equal(engine.inspect().get(100, 50), E.AIR);
});

// Documents compatibility: the scene-reseed opcode is distinct from full engine.reset.
test('legacy_reset_opcode_reseeds_scene_without_resetting_session', () => {
  const engine = E.createEngine({ seed: 11, scene: 'empty' });
  engine.advanceTicks(1, [scheduled(3, 0, { t: 'tempest' })]);
  engine.tick({ paused: true, dt: 0, speed: 1, ops: [{ t: 'tempest' }, { t: 'reset' }] }, ...buffers());
  const state = engine.captureState();
  assert.equal(state.tickIndex, 1);
  assert.equal(state.storm, 2400, 'legacy scene reset retains weather clocks');
  assert.deepEqual(state.commands, [scheduled(3, 0, { t: 'tempest' })]);
  assert.ok(state.cells.some(m => m === E.STONE), 'legacy opcode seeds the vessel');
  engine.reset();
  assert.equal(engine.captureState().tickIndex, 0);
  assert.equal(engine.captureState().storm, 0);
  assert.deepEqual(engine.captureState().commands, []);
});

// Catches re-delivering paused blast effects while retaining the tick-owned event capture.
test('paused_polling_does_not_replay_blast_output', () => {
  const engine = E.createEngine({ seed: 11, scene: 'empty' });
  const result = engine.tick({ paused: true, dt: 0, speed: 1,
    ops: [box(E.TNT, 100, 100, 110, 110), { t: 'heat', x: 105, y: 105, r: 10 }] }, ...buffers());
  assert.ok(result.events.some(e => e.t === 'blast'));
  assert.ok(result.kick > 0);
  const before = engine.captureState();
  const poll = engine.tick({ paused: true, dt: 200, speed: 1 }, ...buffers());
  assert.deepEqual(poll.events, []);
  assert.equal(poll.kick, 0, 'no new event means no new haptic/camera blast');
  sameState(engine.captureState(), before);
});

// Runs the real frame loop with unavailable transport buffers: frames must not enqueue weather.
test('ambient_ember_has_no_wall_or_frame_only_trigger', () => {
  const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  const context = { DCLogic: class { constructor() { this.props = {}; } },
    React: { createRef: () => ({ current: null }) }, performance: { now: () => 0 },
    localStorage: { getItem: () => null }, requestAnimationFrame: () => 1, Float32Array };
  vm.createContext(context); vm.runInContext(script + '\nthis.Component = Component;', context);
  const ui = new context.Component(); ui.M = E; ui.alive = true; ui.have = false;
  for (const now of [45001, 90002, 180000, 3600000]) ui.frame(now);
  assert.equal(ui.ops.length, 0, 'elapsed wall time cannot enqueue rain without world ticks');
  ui.state.paused = true; ui.frame(7200000);
  assert.equal(ui.ops.length, 0, 'paused frames cannot enqueue rain either');
});

// Catches early/duplicate spawning, pre-physics spawning, or pause/reset retaining a timer.
test('ambient_ember_first_spawns_once_at_tick_2700', () => {
  const engine = E.createEngine({ seed: 11, scene: 'empty' });
  const oneGrain = E.createWorld({ seed: 11, scene: 'empty' });
  oneGrain.applyOperation({ t: 'rain', m: E.EMBER, n: 1 });
  engine.advanceTicks(2699);
  const before = engine.captureState();
  assert.ok(before.cells.every(m => m === E.AIR), 'no ambient grain before the first 45 simulated seconds');
  const output = buffers();
  for (let i = 0; i < 8; i++) {
    engine.render(...output, i);
    engine.tick({ paused: true, dt: 3600000, speed: 100 }, ...output);
  }
  sameState(engine.captureState(), before, 'pause/render polling cannot cross the next ember boundary');
  engine.advanceTicks(1);
  const boundary = engine.captureState();
  assert.equal(boundary.tickIndex, 2700);
  assert.equal(boundary.cells.reduce((n, m) => n + (m === E.EMBER), 0), 1);
  assert.equal(engine.inspect().get(1, 1), E.EMBER, 'spawn occurs after this tick physics');
  assert.equal(boundary.random.cosmetic, oneGrain.captureState().random.cosmetic, 'exactly one grain draw at the boundary');
  engine.advanceTicks(1);
  assert.equal(engine.inspect().get(1, 1), E.AIR, 'first movement is on tick 2701');
  engine.reset({ seed: 11, scene: 'empty' });
  engine.advanceTicks(1);
  assert.ok(engine.captureState().cells.every(m => m === E.AIR), 'full reset restarts the 2700-tick schedule');
});
