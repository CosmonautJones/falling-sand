import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as E from '../public/v2/alembic-engine-v2.js';

const load = async path => {
  try { return await import(path); }
  catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; return {}; }
};
const fixtures = await load('./fixtures.js');
const benchmark = await load('../scripts/bench-v2.mjs');
const need = (api, name) => assert.equal(typeof api[name], 'function', `${name} exists`);
const fingerprint = state => createHash('sha256').update(JSON.stringify(state, (_, value) =>
  ArrayBuffer.isView(value) ? { type: value.constructor.name, bytes: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') } : value
)).digest('hex');

// Catches unseeded setup, shared fixture arrays/RNG, or omitted continuation state.
test('fixtures_repeat_full_state_and_own_every_array', () => {
  need(fixtures, 'createFixture');
  const scenes = ['settled', 'falling', 'wet', 'storm'];
  const starts = new Set();
  for (const scene of scenes) {
    const a = fixtures.createFixture({ scene, seed: 73 });
    const b = fixtures.createFixture({ scene, seed: 73 });
    const otherSeed = fixtures.createFixture({ scene, seed: 74 });
    assert.equal(a.captureState().tickIndex, 0, 'setup consumes no hidden ticks');
    const before = fingerprint(b.captureState());
    assert.equal(fingerprint(a.captureState()), before, `${scene} repeats initial full state`);
    assert.notEqual(fingerprint(otherSeed.captureState()), before, `${scene} uses seed`);
    starts.add(fingerprint(a.captureState().cells));
    for (const [field, captured] of Object.entries(a.captureState())) {
      if (!ArrayBuffer.isView(captured)) continue;
      const array = a.inspect()[field];
      assert.notEqual(array, b.inspect()[field], `${scene}.${field} is instance owned`);
      assert.notEqual(array.buffer, b.inspect()[field].buffer, `${scene}.${field} storage is instance owned`);
    }
    a.advanceTicks(13);
    assert.equal(fingerprint(b.captureState()), before, 'advancing one fixture leaves the other unchanged');
    b.advanceTicks(5); b.advanceTicks(8);
    assert.equal(fingerprint(a.captureState()), fingerprint(b.captureState()), `${scene} repeats full continuation across tick batching`);
  }
  assert.equal(starts.size, 4, 'scenes have distinct material layouts');
});

// Catches an empty/default workload or runaway/silently coerced fixture input.
test('fixtures_exercise_named_workloads_with_bounded_commands', () => {
  need(fixtures, 'createFixture');
  const state = scene => fixtures.createFixture({ scene, seed: 9 }).captureState();
  const settled = state('settled');
  assert.ok(settled.cells.includes(E.SAND));
  assert.ok(settled.cells.includes(E.STONE));
  assert.ok(settled.VX.every(v => v === 0) && settled.VY.every(v => v === 0));
  const falling = state('falling');
  assert.ok(falling.cells.slice(0, E.N / 2).includes(E.SAND));
  assert.ok(falling.commands.some(command => command.tick > 120 && command.op.m === E.SAND));
  assert.ok(falling.commands.length <= 100);
  assert.ok(falling.commands.every(command => command.tick >= 1 && command.tick <= 720));
  const wet = state('wet');
  assert.ok(wet.cells.includes(E.WATER) && wet.cells.includes(E.OIL));
  assert.ok(state('storm').storm > 0);
  for (const scene of ['unknown', '', null]) assert.throws(() => fixtures.createFixture({ scene, seed: 9 }), /scene/i);
  for (const seed of [-1, 2 ** 32, NaN, 1.5, '9']) assert.throws(() => fixtures.createFixture({ scene: 'settled', seed }), /seed/i);
});

// Catches hashing cells alone, dropping queues/RNG/counters, or flattening float bits.
test('authoritative_hash_covers_nonvisual_state_and_attached_arrays', () => {
  need(benchmark, 'hashState');
  const original = E.createWorld({ scene: 'empty', seed: 5 }).captureState();
  const hash = benchmark.hashState(original);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(benchmark.hashState(structuredClone(original)), hash);
  for (const mutate of [
    state => { state.shades[0] = -1; },
    state => { state.heat[0]++; },
    state => { state.VX[0] = -0; },
    state => { state.WU[0] = 0.125; },
    state => { state.random.weather++; },
    state => { state.ship.stolen++; },
    state => { state.boltCd++; },
    state => { state.events.push({ t: 'storm' }); },
    state => { state.commands.push({ tick: 1, sequence: 0, op: { t: 'tempest' } }); },
  ]) {
    const changed = structuredClone(original); mutate(changed);
    assert.notEqual(benchmark.hashState(changed), hash);
  }
});

// Catches wrong warmup/tick totals, malformed JSON reporting, or a visual-only final hash.
test('benchmark_cli_reports_exact_tick_counts_percentiles_and_final_state', () => {
  need(fixtures, 'createFixture'); need(benchmark, 'hashState');
  const path = fileURLToPath(new URL('../scripts/bench-v2.mjs', import.meta.url));
  const output = execFileSync(process.execPath, [path, '--scene', 'settled', '--seed', '73'], { encoding: 'utf8' });
  const report = JSON.parse(output).results[0];
  assert.equal(report.scene, 'settled'); assert.equal(report.seed, 73);
  assert.equal(report.warmupTicks, 120); assert.equal(report.measuredTicks, 600);
  assert.equal(report.tickCount, 720);
  assert.equal(report.runtime.node, process.version);
  const { p50, p95, p99 } = report.stepTimeMs;
  assert.ok([p50, p95, p99].every(value => Number.isFinite(value) && value >= 0));
  assert.ok(p50 <= p95 && p95 <= p99, 'nearest-rank percentiles are ordered; no host threshold');
  const reference = fixtures.createFixture({ scene: 'settled', seed: 73 });
  reference.advanceTicks(720);
  assert.deepEqual(report.stateHash, { algorithm: 'sha256', value: benchmark.hashState(reference.captureState()) });
  assert.throws(() => execFileSync(process.execPath, [path, '--scene', 'unknown'], { stdio: 'pipe' }));
  assert.throws(() => execFileSync(process.execPath, [path, '--seed', '-1'], { stdio: 'pipe' }));
});
