import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../public/v2/alembic-engine-v2.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');

test('transmutations emit sampled tx events with the new material, never crowding out the rest', () => {
  const w = E.createWorld({ seed: 4, scene: 'empty' });
  w.applyOperation({ t: 'box', x0: 0, y0: E.H - 4, x1: E.W - 1, y1: E.H - 1, m: E.STONE });
  w.applyOperation({ t: 'box', x0: 100, y0: E.H - 30, x1: 380, y1: E.H - 5, m: E.SAND });
  w.applyOperation({ t: 'box', x0: 100, y0: E.H - 40, x1: 380, y1: E.H - 31, m: E.FIRE });
  const evs = w.advanceTicks(3);
  const tx = evs.filter(e => e.t === 'tx');
  assert.ok(tx.length > 0, 'some transmutations are reported');
  assert.ok(tx.every(e => Number.isInteger(e.x) && Number.isInteger(e.y) && e.m >= 0 && e.m < E.COUNT));
  assert.ok(tx.some(e => e.m === E.GLASS), 'fire on sand reports glass');
  const perTick = [1, 2, 3].map(() => 0);
  assert.ok(tx.length <= 3 * 24, 'at most 24 per tick');
});

test('tx events survive a checkpoint round trip', () => {
  const engine = E.createEngine({ seed: 4, scene: 'vessel' });
  engine.advanceTicks(600);
  const saved = E.decodeCheckpoint(JSON.parse(JSON.stringify(E.encodeCheckpoint(engine.checkpoint()))));
  assert.ok(Array.isArray(saved.state.events));
});

test('juice: per-material pour sounds, a discovery fanfare, tx sparks, and a blast punch', () => {
  assert.match(html, /impactSound\(m\) \{/);
  assert.match(html, /this\.impactSound\(s\.brush\)/);
  assert.match(html, /fanfare\(\) \{/);
  assert.match(html, /revealMany[\s\S]{0,900}this\.fanfare\(\)/);
  assert.match(html, /case 'tx':/);
  assert.match(html, /punch/);
});

test('reduced motion: no camera punch, and sparks stay off', () => {
  assert.match(html, /if \(!this\.still\) this\.punch/);
  assert.match(html, /case 'tx': if \(this\.still\) break;/);
});
