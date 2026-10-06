import * as E from '../public/v2/alembic-engine-v2.js';

export let _sim = E.createTestWorld({ seed: 1 });
export const { W, H } = E;

export function reset() {
  _sim = E.createTestWorld({ seed: 1 });
}

// Bind the assertions in the existing behavior suite to this engine's own world.
export function createEngine() {
  const engine = E.createEngine({ seed: 1, scene: 'empty' });
  _sim = engine.inspect();
  return engine;
}

export function run(n) {
  for (let i = 0; i < n; i++) _sim.step();
}

export function positions(m) {
  const out = [];
  const c = _sim.cells;
  for (let i = 0; i < c.length; i++) if (c[i] === m) out.push([i % W, (i / W) | 0]);
  return out;
}

export function count(m) {
  let n = 0;
  const c = _sim.cells;
  for (let i = 0; i < c.length; i++) if (c[i] === m) n++;
  return n;
}

export function meanY(m) {
  const p = positions(m);
  if (!p.length) return NaN;
  let s = 0;
  for (const [, y] of p) s += y;
  return s / p.length;
}

export function box(x0, y0, x1, y1, m, shade = 0) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) _sim.setc(x, y, m, shade);
}

export function spread(m) {
  const p = positions(m);
  if (!p.length) return { w: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of p) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { w: maxX - minX + 1, minX, maxX, minY, maxY };
}

export { E };
