// Interleaved A/B of two Alembic v2 checkouts on the same host: node scripts/bench-ab-v2.mjs <rootA> <rootB> [rounds]
// Each round runs every fixture scene once on A and once on B (order alternates), so host noise hits both alike.
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [rootA, rootB, roundsArg = '5'] = process.argv.slice(2);
if (!rootA || !rootB) { process.stderr.write('usage: bench-ab-v2.mjs <rootA> <rootB> [rounds]\n'); process.exit(1); }
const rounds = Number(roundsArg);
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 50) { process.stderr.write('rounds must be 1..50\n'); process.exit(1); }

const load = root => import(pathToFileURL(resolve(root, 'tests-v2/fixtures.js')).href);
const A = await load(rootA), B = await load(rootB);
const scenes = A.SCENES.filter(s => B.SCENES.includes(s));
const WARMUP = 120, MEASURED = 600;

function median(xs) { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; }
function run(fixtures, scene) {
  const world = fixtures.createFixture({ scene });
  for (let i = 0; i < WARMUP; i++) world.advanceTicks(1);
  const t = [];
  for (let i = 0; i < MEASURED; i++) { const s = performance.now(); world.advanceTicks(1); t.push(performance.now() - s); }
  return median(t);
}

const res = Object.fromEntries(scenes.map(s => [s, { A: [], B: [] }]));
for (let r = 0; r < rounds; r++) {
  for (const scene of scenes) {
    const order = r % 2 ? [['B', B], ['A', A]] : [['A', A], ['B', B]];
    for (const [k, f] of order) res[scene][k].push(run(f, scene));
  }
}
const rows = scenes.map(scene => {
  const a = median(res[scene].A), b = median(res[scene].B);
  return { scene, A_p50_ms: +a.toFixed(3), B_p50_ms: +b.toFixed(3), ratio: +(b / a).toFixed(3) };
});
process.stdout.write(JSON.stringify({ benchmark: 'alembic-v2-ab', rounds, rootA, rootB, rows }, null, 2) + '\n');
