import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { createFixture, SCENES, DEFAULT_SEED } from '../tests-v2/fixtures.js';

const WARMUP_TICKS = 120;
const MEASURED_TICKS = 600;

// Hash every capture field, nested queue/event/entity and RNG state, including
// typed-array types and exact bytes (signed zero and float payloads included).
// This is same-engine/runtime evidence, not a portable cross-version save hash.
export function hashState(state) {
  const serialized = JSON.stringify(state, (_, value) => ArrayBuffer.isView(value)
    ? { type: value.constructor.name, bytes: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') }
    : value);
  return createHash('sha256').update(serialized).digest('hex');
}

export function runBenchmark({ scene, seed = DEFAULT_SEED }) {
  const world = createFixture({ scene, seed });
  for (let i = 0; i < WARMUP_TICKS; i++) world.advanceTicks(1);
  const times = [];
  for (let i = 0; i < MEASURED_TICKS; i++) {
    const start = performance.now();
    world.advanceTicks(1);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const percentile = p => times[Math.ceil(p * times.length) - 1];
  const state = world.captureState();
  return {
    runtime: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch },
    seed, scene, warmupTicks: WARMUP_TICKS, measuredTicks: MEASURED_TICKS,
    tickCount: state.tickIndex,
    stepTimeMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
    stateHash: { algorithm: 'sha256', value: hashState(state) },
  };
}

function main(args) {
  let scene = 'all', seed = DEFAULT_SEED;
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (value === undefined) throw new Error(`Missing value for ${flag}`);
    if (flag === '--scene') scene = value;
    else if (flag === '--seed') {
      if (!/^(?:[0-9]+|0x[0-9a-f]+)$/i.test(value)) throw new Error('Seed must be a decimal or hexadecimal uint32');
      seed = Number(value);
    } else throw new Error(`Unknown option: ${flag}`);
  }
  if (scene !== 'all' && !SCENES.includes(scene)) throw new Error(`Unknown fixture scene: ${scene}`);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be a uint32');
  const scenes = scene === 'all' ? SCENES : [scene];
  const results = scenes.map(scene => runBenchmark({ scene, seed }));
  process.stdout.write(`${JSON.stringify({ benchmark: 'alembic-v2-step', fixtureVersion: 1, results }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
