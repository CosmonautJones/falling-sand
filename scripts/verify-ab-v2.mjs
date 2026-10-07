// Exact-state regression check between two checkouts, separate from timing:
// node scripts/verify-ab-v2.mjs <baselineRoot> <candidateRoot>
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const [baseRoot, nextRoot] = process.argv.slice(2);
if (!baseRoot || !nextRoot) throw new Error('usage: verify-ab-v2.mjs <baselineRoot> <candidateRoot>');
const load = (root, file) => import(pathToFileURL(resolve(root, file)).href);
const base = await load(baseRoot, 'public/v2/engine/world.js');
const next = await load(nextRoot, 'public/v2/engine/world.js');
const fa = await load(baseRoot, 'tests-v2/fixtures.js');
const fb = await load(nextRoot, 'tests-v2/fixtures.js');
const hash = state => createHash('sha256').update(JSON.stringify(state, (_, value) => ArrayBuffer.isView(value)
  ? { type: value.constructor.name, bytes: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') } : value)).digest('hex');
const results = [];
for (const seed of [1, 73, 0xa341316c]) {
  for (const scene of [...fa.SCENES, 'vessel']) {
    const a = scene === 'vessel' ? base.createWorld({ seed, scene }) : fa.createFixture({ seed, scene });
    const b = scene === 'vessel' ? next.createWorld({ seed, scene }) : fb.createFixture({ seed, scene });
    for (let tick = 1; tick <= 720; tick++) {
      a.step(); b.step();
      if (tick % 120 === 0) assert.equal(hash(b.captureState()), hash(a.captureState()), `${scene} seed ${seed} tick ${tick}`);
    }
    results.push({ scene, seed, ticks: 720, hash: hash(b.captureState()), activity: { ...b.inspect().activity } });
    process.stderr.write(`Equivalent: ${scene}, seed ${seed}, 720 ticks\n`);
  }
}
// Deliberately cross chunk edges, load legacy cell stamps, advance wipes and stir hot/cold fields.
const a = base.createWorld({ seed: 21, scene: 'empty' });
const b = next.createWorld({ seed: 21, scene: 'empty' });
for (let tick = 1; tick <= 240; tick++) {
  const ops = tick === 1 ? [
    { t: 'box', x0: 0, y0: 200, x1: 479, y1: 269, m: base.STONE },
    { t: 'box', x0: 0, y0: 190, x1: 479, y1: 199, m: base.SAND },
  ] : tick === 15 ? [{ t: 'p', x: 32, y: 200, r: 12, m: base.AIR }]
    : tick === 30 ? [{ t: 'heat', x: 80, y: 195, r: 25 }]
    : tick === 50 ? [{ t: 'cool', x: 90, y: 195, r: 22 }]
    : tick === 70 ? [{ t: 'p', x: 120, y: 197, r: 6, m: base.TNT }, { t: 'spark', x: 120, y: 190 }]
    : tick === 110 ? [{ t: 'load', cells: a.captureState().cells }]
    : tick === 180 ? [{ t: 'wipe', mode: 'reset' }] : [];
  for (const op of ops) { a.applyOperation(op); b.applyOperation(op); }
  a.step(); b.step();
  assert.equal(hash(b.captureState()), hash(a.captureState()), `edit tick ${tick}`);
}
results.push({ scene: 'edit-load-wipe', seed: 21, ticks: 240, hash: hash(b.captureState()) });
process.stdout.write(JSON.stringify({ equivalent: true, results }, null, 2) + '\n');
