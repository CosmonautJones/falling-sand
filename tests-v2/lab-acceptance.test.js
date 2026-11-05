import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as E from '../public/v2/alembic-engine-v2.js';

const buffers = () => Array.from({ length: 3 }, () => new Uint8Array(E.N * 4));
const fingerprint = value => createHash('sha256').update(JSON.stringify(value, (_, v) =>
  ArrayBuffer.isView(v)
    ? { type: v.constructor.name, data: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64') }
    : v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]]))
      : v
)).digest('hex');

function movingEngine() {
  const engine = E.createEngine({ seed: 0x51ab1e, scene: 'empty' });
  const sim = engine.inspect();
  assert.equal(typeof sim.setGravity, 'function', 'laboratory worlds expose adjustable gravity');
  sim.setc(240, 30, E.SAND, 0);
  sim.setc(250, 30, E.SAND, 0);
  sim.setc(260, 30, E.WATER, 0);
  return { engine, sim };
}

function centerOf(sim, material) {
  let count = 0, sx = 0, sy = 0;
  for (let i = 0; i < sim.cells.length; i++) if (sim.cells[i] === material) {
    count++;
    sx += i % sim.W;
    sy += Math.floor(i / sim.W);
  }
  return { count, x: count ? sx / count : NaN, y: count ? sy / count : NaN };
}

test('gravity vector changes particle direction and zero gravity removes acceleration', () => {
  const downward = movingEngine();
  downward.sim.setGravity({ x: 0, y: 1 });
  const startDown = centerOf(downward.sim, E.SAND);
  downward.engine.advanceTicks(30);
  assert.ok(centerOf(downward.sim, E.SAND).y > startDown.y + 2, 'positive Y gravity pulls grains down');

  const upward = movingEngine();
  upward.sim.setGravity({ x: 0, y: -1 });
  const startUp = centerOf(upward.sim, E.SAND);
  upward.engine.advanceTicks(30);
  assert.ok(centerOf(upward.sim, E.SAND).y < startUp.y - 2, 'negative Y gravity pulls grains up');

  const lateral = movingEngine();
  lateral.sim.setGravity({ x: 1, y: 0 });
  const startSide = centerOf(lateral.sim, E.SAND);
  lateral.engine.advanceTicks(30);
  assert.ok(centerOf(lateral.sim, E.SAND).x > startSide.x + 2, 'positive X gravity pulls grains right');

  const zero = movingEngine();
  zero.sim.setGravity({ x: 0, y: 0 });
  const index = 30 * E.W + 240;
  zero.sim.VY[index] = 1.25;
  zero.engine.advanceTicks(1);
  const zeroVelocity = zero.sim.cells.reduce((found, material, i) => material === E.SAND ? Math.max(found, Math.abs(zero.sim.VY[i])) : found, 0);
  assert.equal(zeroVelocity, 1.25, 'zero gravity does not add acceleration to an unobstructed grain');
});

test('rigid material islands remain fixed while movable exotic materials conserve mass', () => {
  const engine = E.createEngine({ seed: 0x1ce, scene: 'empty' });
  const sim = engine.inspect();
  sim.setGravity({ x: 0, y: 0 });
  const copper = E.NAMES.indexOf('copper');
  const steel = E.NAMES.indexOf('steel');
  const magnet = E.NAMES.indexOf('magnet');
  const ferrofluid = E.NAMES.indexOf('ferrofluid');
  const tungsten = E.NAMES.indexOf('tungsten');
  for (const [name, material] of [['copper', copper], ['steel', steel], ['magnet', magnet], ['ferrofluid', ferrofluid], ['tungsten', tungsten]]) {
    assert.ok(material > 0, `${name} material is registered`);
  }
  for (let y = 80; y < 86; y++) for (let x = 180; x < 186; x++) sim.setc(x, y, steel, 0);
  sim.setc(230, 40, copper, 0);
  sim.setc(240, 40, magnet, 0);
  for (let y = 20; y < 30; y++) for (let x = 300; x < 310; x++) sim.setc(x, y, ferrofluid, 0);
  for (let y = 25; y < 30; y++) for (let x = 350; x < 360; x++) sim.setc(x, y, tungsten, 0);
  const before = new Map([[steel, centerOf(sim, steel)], [copper, centerOf(sim, copper)], [magnet, centerOf(sim, magnet)], [ferrofluid, centerOf(sim, ferrofluid)], [tungsten, centerOf(sim, tungsten)]]);
  engine.advanceTicks(180);
  for (const [material, start] of before) {
    const end = centerOf(sim, material);
    assert.equal(end.count, start.count, `material ${E.NAMES[material]} is conserved`);
  }
  assert.deepEqual(centerOf(sim, steel), before.get(steel), 'steel island stays fixed');
  assert.deepEqual(centerOf(sim, copper), before.get(copper), 'copper stays fixed');
  assert.deepEqual(centerOf(sim, magnet), before.get(magnet), 'magnet stays fixed');
});

test('gravity and exotic material state survive deterministic checkpoint continuation', () => {
  const first = E.createEngine({ seed: 0xdecafbad, scene: 'empty' });
  const sim = first.inspect();
  assert.equal(typeof sim.setGravity, 'function');
  sim.setGravity({ x: 0.7, y: -0.35 });
  sim.setc(220, 80, E.SAND, 0);
  sim.setc(221, 80, E.WATER, 0);
  first.advanceTicks(17);
  const saved = first.checkpoint();
  first.advanceTicks(45);
  const expected = first.captureState();
  const second = E.createEngine({ seed: 1, scene: 'empty' });
  second.restore(structuredClone(saved));
  second.advanceTicks(45);
  assert.equal(fingerprint(second.captureState()), fingerprint(expected), 'restored gravity run is deterministic');
});

test('invalid checkpoint is rejected atomically', () => {
  const engine = E.createEngine({ seed: 0xabc, scene: 'empty' });
  const sim = engine.inspect();
  sim.setc(200, 90, E.SAND, 0);
  sim.setGravity({ x: -0.5, y: 0.25 });
  engine.advanceTicks(9);
  const before = engine.captureState();
  for (const mutate of [
    checkpoint => { checkpoint.state.cells[E.N - 1] = E.COUNT; },
    checkpoint => { checkpoint.state.gravity.x = 4; checkpoint.state.gravity.y = 4; },
    checkpoint => { checkpoint.state.PX[0] = 0.75; },
  ]) {
    const invalid = engine.checkpoint();
    mutate(invalid);
    assert.throws(() => engine.restore(invalid), /invalid|cell|material|gravity|position|checkpoint/i);
    assert.equal(fingerprint(engine.captureState()), fingerprint(before), 'failed restore leaves every field unchanged');
  }
});
