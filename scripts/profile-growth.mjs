import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { DEFAULT_GROWTH_SEEDS, GROWTH_FIXTURE_VERSION, GROWTH_SCENES, createGrowthFixture, growthCounts } from '../tests-v2/growth-fixtures.js';

export function hashState(state) {
  const serialized = JSON.stringify(state, (_, value) => ArrayBuffer.isView(value)
    ? { type: value.constructor.name, bytes: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') }
    : value);
  return createHash('sha256').update(serialized).digest('hex');
}

function hashFile(path, displayPath) {
  return { path: displayPath, algorithm: 'sha256', value: createHash('sha256').update(readFileSync(path)).digest('hex') };
}

function hashEngineFiles(enginePath) {
  const engineDir = resolve(dirname(enginePath), 'engine');
  const paths = [enginePath, ...readdirSync(engineDir)
    .filter(name => name.endsWith('.js'))
    .map(name => resolve(engineDir, name))];
  return [...new Set(paths)].sort().map(path => hashFile(path, relative(process.cwd(), path)));
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

function parseUint(value, label) {
  if (!/^(?:[0-9]+|0x[0-9a-f]+)$/i.test(value)) throw new Error(`${label} must be a non-negative integer`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) throw new Error(`${label} is out of range`);
  return n;
}

function parsePositive(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be positive`);
  return n;
}

export function parseArgs(args) {
  const options = { seeds: DEFAULT_GROWTH_SEEDS.slice(), seconds: 120, sampleSeconds: 10, scene: 'all', engine: null };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i], value = args[++i];
    if (value === undefined) throw new Error(`Missing value for ${flag}`);
    if (flag === '--seeds') options.seeds = value.split(',').filter(Boolean).map(seed => parseUint(seed, 'Seed'));
    else if (flag === '--seconds') options.seconds = parsePositive(value, 'Seconds');
    else if (flag === '--sample-seconds' || flag === '--interval') options.sampleSeconds = parsePositive(value, 'Sample interval');
    else if (flag === '--scene') options.scene = value;
    else if (flag === '--engine') options.engine = value;
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (!options.seeds.length) throw new Error('At least one seed is required');
  if (options.scene !== 'all' && !GROWTH_SCENES.includes(options.scene)) throw new Error(`Unknown growth fixture scene: ${options.scene}`);
  if (options.sampleSeconds > options.seconds) options.sampleSeconds = options.seconds;
  return options;
}

function runProfile(E, { scene, seed, seconds, sampleSeconds }) {
  const world = createGrowthFixture(E, { scene, seed });
  const initialCounts = growthCounts(E, world);
  const totalTicks = Math.round(seconds * 60);
  const sampleTicks = Math.max(1, Math.round(sampleSeconds * 60));
  const samples = [];
  let elapsedTicks = 0;
  while (elapsedTicks < totalTicks) {
    const ticks = Math.min(sampleTicks, totalTicks - elapsedTicks);
    const timings = [];
    for (let i = 0; i < ticks; i++) {
      const t0 = performance.now(); world.advanceTicks(1); timings.push(performance.now() - t0);
    }
    elapsedTicks += ticks;
    const counts = growthCounts(E, world);
    samples.push({
      seconds: elapsedTicks / 60,
      ticks: elapsedTicks,
      counts,
      tickTimeMs: { p50: percentile(timings, 0.5), p95: percentile(timings, 0.95), p99: percentile(timings, 0.99) },
      stateHash: { algorithm: 'sha256', value: hashState(world.captureState()) },
    });
  }
  return { seed, scene, horizonSeconds: seconds, sampleIntervalSeconds: sampleSeconds, initialCounts, samples };
}

export async function profile(options) {
  const engineUrl = options.engine
    ? pathToFileURL(resolve(process.cwd(), options.engine)).href
    : new URL('../public/v2/alembic-engine-v2.js', import.meta.url).href;
  const enginePath = options.engine ? resolve(process.cwd(), options.engine) : resolve(process.cwd(), 'public/v2/alembic-engine-v2.js');
  const fixturePath = resolve(process.cwd(), 'tests-v2/growth-fixtures.js');
  const E = await import(engineUrl);
  const scenes = options.scene === 'all' ? GROWTH_SCENES : [options.scene];
  const results = [];
  for (const seed of options.seeds) for (const scene of scenes) results.push(runProfile(E, { scene, seed, seconds: options.seconds, sampleSeconds: options.sampleSeconds }));
  return {
    profile: 'alembic-v2-growth-cycle', fixtureVersion: GROWTH_FIXTURE_VERSION,
    sources: {
      fixture: hashFile(fixturePath, 'tests-v2/growth-fixtures.js'),
      engine: hashEngineFiles(enginePath),
    },
    runtime: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch },
    options: { seeds: options.seeds, seconds: options.seconds, sampleSeconds: options.sampleSeconds, scene: options.scene, engine: options.engine ?? 'candidate' },
    results,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(`${JSON.stringify(await profile(parseArgs(process.argv.slice(2))), null, 2)}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
