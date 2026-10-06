import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as E from '../public/v2/alembic-engine-v2.js';

const buffers = () => Array.from({ length: 3 }, () => new Uint8Array(E.N * 4));
const fingerprint = state => createHash('sha256').update(JSON.stringify(state, (_, value) =>
  ArrayBuffer.isView(value) ? Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') : value
)).digest('hex');
const sameState = (actual, expected, message) => assert.equal(fingerprint(actual), fingerprint(expected), message);
const captureEngine = engine => engine.captureState();
const world = E.createWorld;

test('engines_do_not_share_arrays_or_rng', () => {
  const a = E.createEngine({ seed: 31, scene: 'empty' });
  const b = E.createEngine({ seed: 31, scene: 'empty' });
  for (const field of ['cells', 'shades', 'heat', 'trails', 'VX', 'VY', 'born', 'WU', 'WV']) {
    assert.notEqual(a.inspect()[field], b.inspect()[field], `${field} is instance owned`);
  }
  const before = captureEngine(b);
  a.tick({ ops: [{ t: 'p', x: 100, y: 50, r: 3, m: E.SAND }], dt: 34, speed: 1 }, ...buffers());
  sameState(captureEngine(b), before, 'advancing A leaves B fully unchanged');
  const reference = E.createEngine({ seed: 31, scene: 'empty' });
  const message = { ops: [{ t: 'p', x: 90, y: 80, r: 4, m: E.WATER }], dt: 34, speed: 1 };
  b.tick(message, ...buffers());
  reference.tick(message, ...buffers());
  sameState(captureEngine(b), captureEngine(reference), 'B keeps its own random sequence');
});

test('reset_matches_fresh_world', () => {
  const a = world({ seed: 7, scene: 'vessel' });
  a.applyOperation({ t: 'tempest' });
  a.applyOperation({ t: 'p', x: 250, y: 100, r: 10, m: E.FIRE });
  a.inspect().detonate(250, 100, 5);
  for (let i = 0; i < 100; i++) a.step();
  const dirty = a.captureState();
  assert.ok(dirty.WU.some(v => v !== 0) || dirty.WV.some(v => v !== 0), 'wind was exercised');
  assert.ok(dirty.trails.some(v => v !== 0), 'trails were exercised');
  assert.ok(dirty.storm > 0, 'weather was exercised');
  a.applyOperation({ t: 'box', x0: 100, y0: 180, x1: 119, y1: 199, m: E.GOLD });
  for (let i = 0; i < 6; i++) a.step();
  assert.equal(a.captureState().ship.active, true, 'ship and census caches were exercised');
  a.applyOperation({ t: 'wipe', mode: 'clear' });
  assert.equal(a.captureState().wipe, 0, 'pending wipe was exercised');
  for (const scene of ['empty', 'vessel']) {
    a.reset({ seed: 19, scene });
    const fresh = world({ seed: 19, scene });
    sameState(a.captureState(), fresh.captureState());
    a.step(); fresh.step();
    sameState(a.captureState(), fresh.captureState(), 'reset continuation matches fresh');
  }
});

test('visual_rng_does_not_change_world', () => {
  const a = world({ seed: 61, scene: 'vessel' });
  const b = world({ seed: 61, scene: 'vessel' });
  a.applyOperation({ t: 'tempest' }); b.applyOperation({ t: 'tempest' });
  const before = a.captureState();
  const output = buffers();
  for (let i = 0; i < 20; i++) a.render(...output, i);
  sameState(a.captureState(), before, 'render has no world-state side effects');
  for (let i = 0; i < 50; i++) { a.step(); b.step(); }
  sameState(a.captureState(), b.captureState(), 'simulation continuation ignores render count');
});

test('captureState_is_detached_and_preserves_gameplay_shades', () => {
  const a = world({ seed: 1, scene: 'empty' });
  a.inspect().setc(10, 20, E.MITE, 90);
  a.inspect().setc(11, 20, E.MITE, -40);
  a.inspect().setc(12, 20, E.VISITOR, 90);
  a.inspect().setc(13, 20, E.PLASMA, 5);
  const state = a.captureState();
  assert.deepEqual(Array.from(state.shades.slice(20 * E.W + 10, 20 * E.W + 14)), [90, -40, 90, 5]);
  state.cells.fill(E.GOLD); state.shades.fill(0); state.WU.fill(99);
  state.ship.active = true; state.random.physical = 0;
  assert.equal(a.inspect().get(10, 20), E.MITE);
  assert.equal(a.inspect().shades[20 * E.W + 10], 90);
  assert.ok(a.captureState().WU.every(v => v === 0));
  assert.equal(a.captureState().ship.active, false);
});

test('scratch_is_rebuilt_before_simulation_reads_it', () => {
  const a = world({ seed: 11, scene: 'vessel' });
  const b = world({ seed: 11, scene: 'vessel' });
  for (const scratch of Object.values(a.inspect().scratch)) scratch.fill(127);
  a.inspect().born.fill(1);
  const op = { t: 'p', x: 100, y: 80, r: 2, m: E.SAND, vx: 3 };
  a.applyOperation(op); b.applyOperation(op);
  for (let i = 0; i < 10; i++) { a.step(); b.step(); }
  sameState(a.captureState(), b.captureState(), 'scratch contents cannot influence continuation');
});

test('decorative_shades_do_not_consume_gameplay_random_streams', () => {
  const a = world({ seed: 21, scene: 'empty' });
  const before = a.captureState().random;
  a.applyOperation({ t: 'box', x0: 10, y0: 20, x1: 20, y1: 30, m: E.STONE });
  const after = a.captureState().random;
  assert.notEqual(after.cosmetic, before.cosmetic, 'shade generation advances its own generator');
  for (const stream of ['physical', 'ecology', 'weather']) assert.equal(after[stream], before[stream]);
});
