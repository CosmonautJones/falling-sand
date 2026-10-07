import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';
import { createFixture } from './fixtures.js';

const awakeShare = world => { const a = world.inspect().awake; return a.reduce((n, v) => n + v, 0) / a.length; };
function floorWorld(seed = 2) {
  const w = E.createWorld({ seed, scene: 'empty' });
  w.applyOperation({ t: 'box', x0: 0, y0: E.H - 4, x1: E.W - 1, y1: E.H - 1, m: E.STONE });
  return w;
}

test('a settled vessel falls asleep: most chunks skip the cell pass', () => {
  const w = createFixture({ scene: 'settled' });
  w.advanceTicks(240);
  assert.ok(awakeShare(w) < 0.1, `awake share ${awakeShare(w).toFixed(3)}`);
});

test('a grain dropped into a sleeping region still falls', () => {
  const w = floorWorld();
  w.advanceTicks(30);
  w.applyOperation({ t: 'p', x: 240, y: 40, r: 0, m: E.SAND });
  w.advanceTicks(200);
  const sim = w.inspect();
  let landed = false; for (let x = 0; x < E.W; x++) if (sim.get(x, E.H - 5) === E.SAND) landed = true;
  assert.ok(landed, 'the grain reached the floor');
});

test('a reaction across a chunk edge still happens after both sides slept', () => {
  const w = floorWorld();
  const y = E.H - 5; // a 2-cell water puddle walled in, ending at a chunk edge (x = 15 | 16)
  w.applyOperation({ t: 'box', x0: 13, y0: y - 3, x1: 13, y1: y, m: E.STONE });
  w.applyOperation({ t: 'box', x0: 18, y0: y - 3, x1: 18, y1: y, m: E.STONE });
  w.applyOperation({ t: 'box', x0: 14, y0: y, x1: 15, y1: y, m: E.WATER });
  w.advanceTicks(120);
  w.applyOperation({ t: 'p', x: 16, y, r: 0, m: E.SEED });
  w.advanceTicks(5);
  assert.notEqual(w.inspect().get(16, y), E.SEED, 'the seed drank across the edge');
});

test('fire spreads through wood that had gone to sleep', () => {
  const w = floorWorld();
  w.applyOperation({ t: 'box', x0: 100, y0: E.H - 12, x1: 160, y1: E.H - 5, m: E.WOOD });
  w.advanceTicks(120);
  w.applyOperation({ t: 'p', x: 100, y: E.H - 8, r: 0, m: E.FIRE });
  w.advanceTicks(400);
  const wood = w.inspect().cells.reduce((n, c) => n + (c === E.WOOD), 0);
  assert.ok(wood < 61 * 8 / 2, `most of the wood burned: ${wood} left`);
});

test('a blast throws sand that had gone to sleep', () => {
  const w = floorWorld();
  w.applyOperation({ t: 'box', x0: 200, y0: E.H - 10, x1: 260, y1: E.H - 5, m: E.SAND });
  w.advanceTicks(200);
  const before = Uint8Array.from(w.inspect().cells);
  w.inspect().detonate(230, E.H - 8, 4);
  w.advanceTicks(40);
  let moved = 0; const after = w.inspect().cells;
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) moved++;
  assert.ok(moved > 25, `blast moved ${moved} cells`);
});

test('skipping quiet heat is exact: a world restored every tick (never skipping) matches one that skips', () => {
  const a = E.createWorld({ seed: 12, scene: 'vessel' }), b = E.createWorld({ seed: 12, scene: 'vessel' });
  for (let t = 0; t < 240; t++) {
    a.advanceTicks(1);
    b.restore(b.captureState()); b.advanceTicks(1);
  }
  assert.deepEqual(a.captureState().heat, b.captureState().heat);
  assert.deepEqual(a.captureState().cells, b.captureState().cells);
});

test('fire painted into long-quiet air still warms the air around it', () => {
  const w = floorWorld(), ref = floorWorld();
  w.advanceTicks(120); ref.advanceTicks(120);
  for (const x of [w, ref]) x.applyOperation({ t: 'p', x: 240, y: 100, r: 1, m: E.FIRE });
  for (let t = 0; t < 6; t++) { w.advanceTicks(1); ref.restore(ref.captureState()); ref.advanceTicks(1); }
  assert.ok(w.inspect().heat[100 * E.W + 242] > 18, 'the air next to the fire warmed');
  assert.deepEqual(w.captureState().heat, ref.captureState().heat);
});

test('checkpoints carry the sleep marks, and older checkpoints without them still load', () => {
  const engine = E.createEngine({ seed: 4, scene: 'vessel' });
  engine.advanceTicks(90);
  const saved = E.decodeCheckpoint(JSON.parse(JSON.stringify(E.encodeCheckpoint(engine.checkpoint()))));
  assert.ok(saved.state.dirty instanceof Uint8Array, 'dirty marks are saved');
  engine.advanceTicks(30); const expected = engine.captureState();
  engine.restore(structuredClone(saved)); engine.advanceTicks(30);
  assert.deepEqual(engine.captureState().cells, expected.cells, 'continuation is exact');
  const legacy = structuredClone(saved); delete legacy.state.dirty;
  engine.restore(legacy); engine.advanceTicks(30);
  assert.equal(engine.inspect().awake.length, 60 * 34);
});
