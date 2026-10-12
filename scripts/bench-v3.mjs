// node scripts/bench-v3.mjs [rounds=5]. Wall timings never drive simulation state.
import { performance } from 'node:perf_hooks';
import { createValley } from '../public/v3/valley.js';
import { createEcology, ECO_TICKS } from '../public/v3/ecology.js';
import { createWorld } from '../public/v2/engine/world.js';

const rounds = Number(process.argv[2] ?? 5);
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 50) throw new Error('rounds must be 1..50');
const quantile = (xs, q) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))];
const rows = [];
for (const scene of ['ready', 'flood', 'fire']) {
  const soilWork = [],
    ecology = [],
    total = [];
  let final;
  for (let r = 0; r < rounds; r++) {
    const valley = createValley({ seed: 0xc00c17 });
    if (scene !== 'ready') {
      valley.openDam();
      valley.advanceTicks(600);
    }
    if (scene === 'fire') {
      const plant = valley.inspect().soil.plants.find((p) => p && p.x > 170 && p.x < 280);
      valley.applyTool({ tool: 'fire', x: plant.x, y: plant.y - 4, r: 9 });
    }
    const saved = valley.checkpoint();
    const world = createWorld({
      scene: 'empty',
      seed: saved.seed,
      vegetation: 'managed',
      ambientEmbers: false,
    });
    world.restore(saved.world.state);
    const soil = createEcology({
      world: world.inspect(),
      surface: saved.surface,
      seed: saved.seed,
    });
    soil.restore(saved.ecology);
    for (let i = 1; i <= 720; i++) {
      const start = performance.now();
      world.advanceTicks(1);
      const afterGrain = performance.now();
      soil.observeFire();
      const due = (saved.tick + i) % ECO_TICKS === 0;
      if (due) soil.step();
      const end = performance.now();
      if (i > 120) {
        soilWork.push(end - afterGrain);
        total.push(end - start);
        if (due) ecology.push(end - afterGrain);
      }
    }
    final = soil.stats();
  }
  rows.push({
    scene,
    tick_p50_ms: +quantile(total, 0.5).toFixed(3),
    tick_p95_ms: +quantile(total, 0.95).toFixed(3),
    soil_p50_ms: +quantile(ecology, 0.5).toFixed(3),
    soil_p95_ms: +quantile(ecology, 0.95).toFixed(3),
    soil_amortized_ms_per_tick: +(soilWork.reduce((a, b) => a + b, 0) / total.length).toFixed(4),
    final,
  });
}
console.log(
  JSON.stringify(
    { benchmark: 'living-valley-v1', rounds, warmup: 120, measured: 600, rows },
    null,
    2,
  ),
);
