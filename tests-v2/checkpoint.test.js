import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as E from '../public/v2/alembic-engine-v2.js';

const buffers = () => Array.from({ length: 3 }, () => new Uint8Array(E.N * 4));
const fingerprint = value => createHash('sha256').update(JSON.stringify(value, (_, v) =>
  ArrayBuffer.isView(v) ? { type: v.constructor.name, data: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64') }
    : v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v
)).digest('hex');
const same = (a, b, message) => assert.equal(fingerprint(a), fingerprint(b), message);
const requireCheckpoints = engine => {
  assert.equal(typeof engine.checkpoint, 'function', 'engine exposes a full checkpoint');
  assert.equal(typeof engine.restore, 'function', 'engine can atomically restore it');
};

// Every accepted operation must survive a queued checkpoint, including typed scene stamps and snap.
test('all_accepted_scheduled_operation_variants_are_detached_and_exportable', () => {
  const engine = E.createEngine({ seed: 11, scene: 'empty' });
  const cells = new Uint8Array(E.N); cells[100] = E.GLASS;
  const ops = [
    { t: 'l', x0: 10, y0: 10, x1: 15, y1: 15, r: 1, m: E.STONE, vx: 1, vy: -1 },
    { t: 'p', x: 10, y: 10, r: 1, m: E.GLASS },
    { t: 'spray', x: 10, y: 10, r: 1.5, m: E.SAND, n: 3, vx: 1, vy: 2 },
    { t: 'box', x0: 10, y0: 10, x1: 12, y1: 12, m: E.STONE },
    { t: 'heat', x: 10, y: 10, r: 2 }, { t: 'cool', x: 10, y: 10, r: 2 },
    { t: 'rain', m: E.SAND, n: 3 }, { t: 'tempest' }, { t: 'clear' }, { t: 'reset' },
    { t: 'wipe', mode: 'clear' }, { t: 'wipe', mode: 'reset' }, { t: 'wipe', mode: 'load', cells },
    { t: 'load', cells }, { t: 'snap' },
  ];
  const commands = ops.map((op, sequence) => ({ tick: 1, sequence, op }));
  engine.advanceTicks(0, commands);
  ops[1].m = E.GOLD; cells[100] = E.GOLD;
  const saved = engine.checkpoint();
  assert.equal(saved.state.commands[1].op.m, E.GLASS);
  assert.equal(saved.state.commands[13].op.cells[100], E.GLASS);
  const restored = E.createEngine({ scene: 'empty' });
  restored.restore(E.decodeCheckpoint(JSON.parse(JSON.stringify(E.encodeCheckpoint(saved)))));
  same(restored.checkpoint(), saved);
  const snaps = [];
  const world = E.createWorld({ scene: 'empty' }); world.restore(saved.state);
  world.advanceTicks(1, [], (op, result) => { if (op.t === 'snap') snaps.push(result); });
  assert.equal(snaps[0].cells[100], E.GLASS, 'queued snap executes after preceding load before physics');
  engine.advanceTicks(1); restored.advanceTicks(1);
  same(restored.captureState(), engine.captureState());
});

// Large otherwise-valid batches must not poison exportability of a previously valid checkpoint.
test('oversized_queued_commands_are_rejected_before_mutation', () => {
  const engine = E.createEngine({ scene: 'empty' });
  const before = engine.captureState();
  const commands = Array.from({ length: 100 }, (_, sequence) => ({ tick: 1, sequence, op: { t: 'load', cells: new Uint8Array(E.N) } }));
  assert.throws(() => engine.advanceTicks(0, commands), /16 MiB/);
  same(engine.captureState(), before);
  assert.doesNotThrow(() => E.encodeCheckpoint(engine.checkpoint()));
});

test('command_size_limit_includes_existing_queue_and_world_payload', () => {
  const engine = E.createEngine({ scene: 'empty' });
  const command = sequence => ({ tick: 1, sequence, op: { t: 'load', cells: new Uint8Array(E.N) } });
  engine.advanceTicks(0, Array.from({ length: 40 }, (_, sequence) => command(sequence)));
  const before = engine.captureState();
  assert.throws(() => engine.advanceTicks(0, Array.from({ length: 45 }, (_, i) => command(i + 40))), /16 MiB/);
  same(engine.captureState(), before);
  assert.doesNotThrow(() => E.encodeCheckpoint(engine.checkpoint()));
});
function movingWorld() {
  const engine = E.createEngine({ seed: 71, scene: 'empty' });
  engine.advanceTicks(13, [
    { tick: 1, sequence: 0, op: { t: 'box', x0: 200, y0: 200, x1: 219, y1: 219, m: E.GOLD } },
    { tick: 1, sequence: 1, op: { t: 'tempest' } },
    { tick: 17, sequence: 0, op: { t: 'p', x: 120, y: 50, r: 3, m: E.WATER, vx: -2, vy: 1 } },
    { tick: 17, sequence: 1, op: { t: 'heat', x: 120, y: 55, r: 4 } },
  ]);
  const sim = engine.inspect();
  sim.setc(90, 80, E.SAND, -7); sim.VX[80 * E.W + 90] = 3.25; sim.VY[80 * E.W + 90] = -1.5;
  sim.setc(100, 130, E.MITE, 90); sim.setc(101, 130, E.MITE, -40);
  sim.setc(102, 130, E.PLANT, 3); sim.heat[130 * E.W + 100] = 120;
  return engine;
}

// Catches missing authoritative fields, random streams, queues and deferred wipe targets.
test('checkpoint_continues_exactly', () => {
  for (const deferredWipe of [false, true]) {
    const engine = movingWorld(); requireCheckpoints(engine);
    if (deferredWipe) engine.tick({ paused: true, ops: [{ t: 'wipe', mode: 'clear' }] }, ...buffers());
    const saved = engine.checkpoint();
    assert.deepEqual([saved.format, saved.version, saved.width, saved.height, saved.tick], ['alembic-world', 1, 480, 270, 13]);
    assert.equal(saved.state.ship.active, true);
    assert.ok(saved.state.storm > 0);
    assert.equal(saved.state.shades[130 * E.W + 100], 90);
    assert.equal(saved.state.shades[130 * E.W + 101], -40);
    assert.equal(saved.state.commands.length, 2);
    const initial = E.createEngine({ seed: 71, scene: 'empty' }).captureState().random;
    engine.advanceTicks(25);
    const expected = engine.captureState();
    for (const stream of ['physical', 'ecology', 'weather', 'cosmetic']) assert.notEqual(expected.random[stream], initial[stream], `${stream} exercised`);
    engine.restore(structuredClone(saved));
    same(engine.captureState(), saved.state, 'restore reproduces every captured field');
    engine.advanceTicks(25);
    same(engine.captureState(), expected, 'continuation is exact after restore');
    const world = E.createWorld({ seed: 1, scene: 'empty' });
    assert.equal(typeof world.restore, 'function');
    world.restore(saved.state); world.advanceTicks(25);
    same(world.captureState(), expected, 'world restore shares the validated state contract');
  }
});

// Catches capture/restore aliasing caller-owned arrays, queue payloads, entities or RNG.
test('checkpoint_is_detached', () => {
  const engine = movingWorld(); requireCheckpoints(engine);
  engine.advanceTicks(0, [{ tick: 40, sequence: 0, op: { t: 'load', cells: new Uint8Array(E.N).fill(E.STONE) } }]);
  const before = engine.captureState();
  const saved = engine.checkpoint();
  engine.restore(saved);
  saved.state.cells.fill(E.GOLD); saved.state.VX.fill(99); saved.state.WU.fill(99);
  saved.state.ship.active = false; saved.state.random.weather = 0;
  saved.state.commands[0].op.m = E.GOLD; saved.state.commands[2].op.cells.fill(E.AIR);
  same(engine.captureState(), before, 'mutating checkpoint cannot change a restored world');
});

// Catches lossy JSON arrays, signed cargo shades, float byte loss and nested typed payloads.
test('roundtrip_preserves_typed_payloads', () => {
  const engine = movingWorld(); requireCheckpoints(engine);
  assert.equal(typeof E.encodeCheckpoint, 'function'); assert.equal(typeof E.decodeCheckpoint, 'function');
  engine.advanceTicks(0, [{ tick: 40, sequence: 0, op: { t: 'wipe', mode: 'load', cells: new Uint8Array(E.N).fill(E.SAND) } }]);
  engine.tick({ paused: true, ops: [{ t: 'wipe', mode: 'clear' }] }, ...buffers());
  engine.inspect().VX[0] = -0;
  const saved = engine.checkpoint();
  const encoded = E.encodeCheckpoint(saved);
  assert.deepEqual(encoded.state.shades.type, 'Int8Array');
  assert.deepEqual(encoded.state.VX.type, 'Float32Array');
  assert.deepEqual(encoded.state.cells.type, 'Uint8Array');
  const decoded = E.decodeCheckpoint(JSON.parse(JSON.stringify(encoded)));
  same(decoded, saved, 'all fields and bytes survive a real JSON roundtrip');
  assert.ok(decoded.state.commands[2].op.cells instanceof Uint8Array);
  assert.ok(decoded.state.wipeS instanceof Int8Array);
  assert.ok(Object.is(decoded.state.VX[0], -0));
  engine.advanceTicks(35); const expected = engine.captureState();
  engine.restore(decoded); engine.advanceTicks(35); same(engine.captureState(), expected);
});

// Catches validation after partial mutation, including late-invalid queue/RNG fields.
test('invalid_checkpoint_is_atomic', () => {
  const engine = movingWorld(); requireCheckpoints(engine);
  const saved = engine.checkpoint(); const before = engine.captureState();
  const invalid = [
    c => { c.version = 2; }, c => { c.width = 479; }, c => { c.height = 271; }, c => { c.format = 'other'; },
    c => { c.tick++; }, c => { c.state.cells = new Uint8Array(E.N - 1); },
    c => { c.state.shades = new Uint8Array(E.N); }, c => { c.state.cells[E.N - 1] = E.COUNT; },
    c => { c.state.VX[E.N - 1] = Infinity; }, c => { c.state.VY[0] = NaN; }, c => { c.state.WU[0] = Infinity; },
    c => { c.state.storm = -1; }, c => { c.state.tickIndex = 0.5; }, c => { c.state.ship.stolen = -1; },
    c => { c.state.random.cosmetic = 2 ** 32; }, c => { c.state.commands[1].tick = c.tick; },
    c => { c.state.commands[1].sequence = 0; }, c => { c.state.commands[1].op.r = Infinity; },
    c => { c.state.commands[1].op.t = 'unknown'; }, c => { c.state.commands[1].op.t = ['heat']; },
    c => { c.state.events = [{ t: ['storm'] }]; }, c => { c.state.ship.active = 1; },
    c => { c.state.wipe = 0; }, c => { c.state.events = [{ t: 'unknown' }]; },
    c => { c.state.commands[1].op = JSON.parse('{"t":"clear","__proto__":{"polluted":true}}'); },
    c => { Object.defineProperty(c.state, 'flash', { get() { throw new Error('getter invoked'); }, enumerable: true }); },
  ];
  for (const mutate of invalid) {
    const value = structuredClone(saved); mutate(value);
    assert.throws(() => engine.restore(value)); same(engine.captureState(), before, 'every rejected checkpoint leaves world unchanged');
  }
  const encoded = E.encodeCheckpoint(saved);
  for (const mutate of [
    c => { c.state.cells.data = '!'.repeat(c.state.cells.data.length); },
    c => { c.state.VX.data = c.state.VX.data.slice(4); },
    c => { c.state.cells.type = 'Float64Array'; },
    c => { c.state.cells.data = 'A'.repeat(16 * 1024 * 1024 + 1); },
    c => { c.state.random.physical = -1; },
  ]) {
    const value = structuredClone(encoded); mutate(value);
    assert.throws(() => engine.restore(E.decodeCheckpoint(value))); same(engine.captureState(), before);
  }
  assert.equal({}.polluted, undefined);
});

// Catches a successful restore keeping old wall-time remainder, or a failed restore clearing it.
test('checkpoint_restore_resets_only_successful_host_accumulation', () => {
  const engine = E.createEngine({ seed: 1, scene: 'empty' }); requireCheckpoints(engine);
  const saved = engine.checkpoint();
  engine.tick({ dt: 10, speed: 1 }, ...buffers());
  const bad = structuredClone(saved); bad.version = 2;
  assert.throws(() => engine.restore(bad));
  engine.tick({ dt: 7, speed: 1 }, ...buffers());
  assert.equal(engine.captureState().tickIndex, 1, 'failed restore leaves accumulator intact');
  engine.restore(saved);
  engine.tick({ dt: 10, speed: 1 }, ...buffers()); engine.restore(saved);
  engine.tick({ dt: 7, speed: 1 }, ...buffers());
  assert.equal(engine.captureState().tickIndex, 0, 'successful restore starts with zero accumulator');
});

// Catches aggregate-size checks performed after decoding, and unsafe discriminators.
test('checkpoint_preflights_aggregate_size_and_plain_schema_values', () => {
  const engine = E.createEngine({ seed: 1, scene: 'empty' }); requireCheckpoints(engine);
  const before = engine.captureState(); const saved = engine.checkpoint();
  const encoded = E.encodeCheckpoint(saved);
  const load = { t: 'load', cells: encoded.state.cells };
  encoded.state.commands = Array.from({ length: 100 }, (_, sequence) => ({ tick: 1, sequence, op: load }));
  encoded.state.cells.data = '!'.repeat(encoded.state.cells.data.length);
  assert.throws(() => E.decodeCheckpoint(encoded), /16 MiB/, 'entire input size checked before the first bad payload is decoded');
  saved.state.commands = Array.from({ length: 100 }, (_, sequence) => ({ tick: 1, sequence, op: { t: 'load', cells: saved.state.cells } }));
  assert.throws(() => engine.restore(saved), /16 MiB/);
  same(engine.captureState(), before);
  const odd = engine.checkpoint();
  let coerced = false;
  odd.state.commands = [{ tick: 1, sequence: 0, op: { t: { toString() { coerced = true; return 'clear'; } } } }];
  assert.throws(() => engine.restore(odd));
  assert.equal(coerced, false, 'invalid operation discriminator must never be coerced');
  const world = E.createWorld({ scene: 'empty' }); const worldBefore = world.captureState();
  const invalid = structuredClone(worldBefore); invalid.random.cosmetic = NaN;
  assert.throws(() => world.restore(invalid)); same(world.captureState(), worldBefore);
});

// Catches character-count limits or escaped JSON/Unicode bytes miscounted at the boundary.
test('checkpoint_serialized_limit_counts_actual_json_utf8_bytes', () => {
  const encoded = E.encodeCheckpoint(E.createEngine({ scene: 'empty' }).checkpoint());
  encoded.padding = '';
  const available = 16 * 1024 * 1024 - Buffer.byteLength(JSON.stringify(encoded));
  for (const [character, bytes] of [['a', 1], ['\0', 6], ['é', 2], ['\ud800', 6], ['😀', 4]]) {
    encoded.padding = character.repeat(Math.floor(available / bytes)) + 'a'.repeat(available % bytes);
    assert.equal(Buffer.byteLength(JSON.stringify(encoded)), 16 * 1024 * 1024);
    assert.throws(() => E.decodeCheckpoint(encoded), /unknown object key/, 'exact byte limit passes preflight and reaches schema validation');
    encoded.padding += 'a';
    assert.throws(() => E.decodeCheckpoint(encoded), /16 MiB/, 'one extra serialized byte fails before schema validation');
  }
});

// Catches an ambient clock outside tickIndex, or replaying a committed boundary on restore.
test('checkpoint_preserves_ambient_ember_boundary', () => {
  const engine = E.createEngine({ seed: 11, scene: 'empty' });
  const nearBoundary = engine.checkpoint();
  nearBoundary.tick = nearBoundary.state.tickIndex = 2698;
  engine.restore(nearBoundary);
  engine.advanceTicks(1);
  const before = E.decodeCheckpoint(JSON.parse(JSON.stringify(E.encodeCheckpoint(engine.checkpoint()))));
  engine.advanceTicks(2);
  assert.equal(engine.captureState().cells.reduce((n, m) => n + (m === E.EMBER), 0), 1);
  const after = engine.captureState();
  engine.restore(before); engine.advanceTicks(2);
  same(engine.captureState(), after, 'pre-boundary checkpoint repeats exact grain and RNG continuation');
  engine.restore(before); engine.advanceTicks(1);
  const committed = E.decodeCheckpoint(JSON.parse(JSON.stringify(E.encodeCheckpoint(engine.checkpoint()))));
  assert.equal(committed.tick, 2700);
  assert.equal(committed.state.cells[1 * E.W + 1], E.EMBER);
  engine.restore(committed);
  engine.advanceTicks(1);
  same(engine.captureState(), after, 'post-boundary checkpoint never replays the committed spawn');
  const nextBoundary = engine.checkpoint();
  nextBoundary.tick = nextBoundary.state.tickIndex = 5399;
  nextBoundary.state.scanDir = -1;
  engine.restore(nextBoundary); engine.advanceTicks(1);
  assert.equal(engine.inspect().get(1, 1), E.EMBER, 'the next 2700-tick interval also spawns once');
});
