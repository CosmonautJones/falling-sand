import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cpus } from 'node:os';

const roots = [resolve('qa-shots/growth/main-baseline'), resolve('.')];
const fixtures = await Promise.all(roots.map(root => import(pathToFileURL(resolve(root, 'tests-v2/fixtures.js')).href)));
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1];
};
const median = values => percentile(values, 0.5);
const samples = Object.fromEntries(fixtures[0].SCENES.map(scene => [scene, [[], []]]));
for (let round = 0; round < 5; round++) {
  for (const scene of fixtures[0].SCENES) {
    for (const index of (round % 2 ? [1, 0] : [0, 1])) {
      const world = fixtures[index].createFixture({ scene });
      world.advanceTicks(120);
      const times = [];
      for (let tick = 0; tick < 600; tick++) {
        const start = performance.now();
        world.advanceTicks(1);
        times.push(performance.now() - start);
      }
      samples[scene][index].push({
        p50: percentile(times, 0.5), p95: percentile(times, 0.95), p99: percentile(times, 0.99),
        ticksPerSecond: 600000 / times.reduce((a, b) => a + b, 0),
      });
    }
  }
}
const summaries = trials => Object.fromEntries(['p50', 'p95', 'p99', 'ticksPerSecond'].map(key => [key, median(trials.map(trial => trial[key]))]));
const hash = root => createHash('sha256').update(readFileSync(resolve(root, 'public/v2/engine/world.js'))).digest('hex');
console.log(JSON.stringify({
  benchmark: 'alembic-v2-integrated-ab', rounds: 5, warmupTicks: 120, measuredTicks: 600,
  seed: fixtures[0].DEFAULT_SEED, fixtureVersion: 1,
  runtime: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch, cpu: cpus()[0].model },
  sources: roots.map(root => ({ root, worldSha256: hash(root) })),
  rows: Object.entries(samples).map(([scene, trials]) => {
    const baseline = summaries(trials[0]), candidate = summaries(trials[1]);
    return { scene, baseline, candidate, p50Ratio: candidate.p50 / baseline.p50, trials };
  }),
}, null, 2));
