// node scripts/bench-fuse-v2.mjs [rounds=5]
import { performance } from 'node:perf_hooks';
import { createEngine, FIRE } from '../public/v2/alembic-engine-v2.js';
import { createFuseCheckpoint } from '../public/v2/play.js';

const rounds = Number(process.argv[2] ?? 5);
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 50) throw new Error('rounds must be 1..50');
const median = values => [...values].sort((a, b) => a - b)[values.length >> 1];
const rows = [];
for (const scene of ['ready', 'chain']) {
  const p50 = [], p95 = [];
  let firstBlastTick = null, blasts = 0;
  for (let r = 0; r < rounds; r++) {
    const engine = createEngine(); engine.restore(createFuseCheckpoint());
    engine.advanceTicks(120);
    if (scene === 'chain') engine.advanceTicks(0, [{ tick: 121, sequence: 0, op: { t: 'p', x: 260, y: 92, r: 3, m: FIRE } }]);
    const times = [];
    firstBlastTick = null; blasts = 0;
    for (let i = 1; i <= 360; i++) {
      const began = performance.now(), events = engine.advanceTicks(1);
      times.push(performance.now() - began);
      const n = events.filter(e => e.t === 'blast').length;
      if (n && firstBlastTick === null) firstBlastTick = i;
      blasts += n;
    }
    times.sort((a, b) => a - b);
    p50.push(times[180]); p95.push(times[342]);
  }
  rows.push({ scene, p50_ms: +median(p50).toFixed(3), p95_ms: +median(p95).toFixed(3), firstBlastTick, blasts });
}
console.log(JSON.stringify({ benchmark: 'alembic-fuse-v1', node: process.version, platform: process.platform, arch: process.arch, rounds, warmupTicks: 120, measuredTicks: 360, rows }, null, 2));
