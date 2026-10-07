import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/v2/alembic-engine-v2.js';

const NEW = ['SNOW', 'CHARCOAL', 'SULFUR', 'HONEY', 'AMBER', 'FUNGUS', 'SPORE', 'FIREFLY', 'CORAL', 'PUMICE'];
const FLOOR = E.H - 4;
function world(seed = 5) {
  const w = E.createWorld({ seed, scene: 'empty' });
  w.applyOperation({ t: 'box', x0: 0, y0: FLOOR, x1: E.W - 1, y1: E.H - 1, m: E.STONE });
  return w;
}
const box = (w, x0, y0, x1, y1, m) => w.applyOperation({ t: 'box', x0, y0, x1, y1, m });
const put = (w, x, y, m) => w.inspect().setc(x, y, m, 0);
const count = (w, m) => w.inspect().cells.reduce((n, c) => n + (c === m), 0);
const run = (w, n) => w.advanceTicks(n);

test('ten new transmuted materials, each with a codex page and a hint', () => {
  for (const name of NEW) {
    const id = E[name];
    assert.ok(Number.isInteger(id) && id >= 43 && id < E.COUNT, name);
    assert.equal(E.NAMES[id], name.toLowerCase());
    assert.ok(E.TRANSMUTED.includes(id), `${name} is discoverable`);
    assert.ok(E.PAGES[id] && E.PAGES[id].w && E.PAGES[id].l, `${name} page`);
    assert.ok(E.HINTS[id], `${name} hint`);
    assert.equal(E.COLORS[id].length, 3);
  }
  assert.equal(E.NAMES.length, E.COUNT);
  assert.equal(E.PAGES.length, E.COUNT);
});

test('snow: a cloud that touches ice snows; snow melts by fire and salts into brine', () => {
  let w = world();
  box(w, 200, 100, 210, 102, E.ICE); box(w, 200, 99, 210, 99, E.CLOUD);
  run(w, 2);
  assert.ok(count(w, E.SNOW) > 0, 'snow formed');
  w = world(); box(w, 200, FLOOR - 3, 210, FLOOR - 1, E.SNOW); box(w, 211, FLOOR - 3, 213, FLOOR - 1, E.FIRE);
  run(w, 120); assert.ok(count(w, E.SNOW) < 33, 'fire melts snow');
  w = world(); put(w, 200, FLOOR - 1, E.SNOW); put(w, 201, FLOOR - 1, E.SALT);
  run(w, 3); assert.ok(count(w, E.BRINE) > 0, 'salt makes brine of snow');
});

test('charcoal: a buried ember keeps as charcoal; charcoal smoulders back to ember and filters acid', () => {
  let w = world();
  box(w, 190, FLOOR - 6, 210, FLOOR - 1, E.SAND); put(w, 200, FLOOR - 3, E.EMBER);
  run(w, 3); assert.equal(count(w, E.CHARCOAL), 1, 'buried ember becomes charcoal');
  w = world(); box(w, 200, FLOOR - 2, 210, FLOOR - 1, E.CHARCOAL); put(w, 199, FLOOR - 1, E.FIRE);
  let embers = 0; for (let t = 0; t < 60; t++) { run(w, 1); embers = Math.max(embers, count(w, E.EMBER)); }
  assert.ok(embers > 0, 'fire wakes charcoal as ember');
  w = world(); box(w, 200, FLOOR - 1, 210, FLOOR - 1, E.CHARCOAL); put(w, 205, FLOOR - 2, E.ACID);
  run(w, 4); assert.equal(count(w, E.ACID), 0, 'acid is filtered'); assert.ok(count(w, E.WATER) >= 1);
});

test('sulfur: acid on ash leaves sulfur; sulfur burns, and wet sulfur turns to acid', () => {
  let w = world();
  box(w, 200, FLOOR - 1, 210, FLOOR - 1, E.ASH); put(w, 205, FLOOR - 2, E.ACID);
  run(w, 3); assert.ok(count(w, E.SULFUR) > 0, 'sulfur formed');
  w = world(); box(w, 200, FLOOR - 2, 210, FLOOR - 1, E.SULFUR); put(w, 199, FLOOR - 1, E.FIRE);
  run(w, 60); assert.ok(count(w, E.SULFUR) < 22, 'sulfur burns');
  w = world(); box(w, 199, FLOOR - 6, 199, FLOOR - 1, E.STONE); box(w, 211, FLOOR - 6, 211, FLOOR - 1, E.STONE);
  box(w, 200, FLOOR - 1, 210, FLOOR - 1, E.SULFUR); box(w, 200, FLOOR - 4, 210, FLOOR - 2, E.WATER);
  run(w, 900); assert.ok(count(w, E.ACID) > 0, 'acid rain from wet sulfur');
});

test('honey and amber: mites feeding at bloom leave honey; fire sets honey to amber; lava melts amber', () => {
  let w = world(8);
  box(w, 150, FLOOR - 1, 250, FLOOR - 1, E.BLOOM);
  for (let x = 152; x < 250; x += 4) put(w, x, FLOOR - 2, E.MITE);
  let honey = 0; for (let t = 0; t < 600; t++) { run(w, 1); if (t % 20 === 0) honey = Math.max(honey, count(w, E.HONEY)); }
  assert.ok(honey > 0, 'honey left behind');
  w = world(); box(w, 200, FLOOR - 2, 210, FLOOR - 1, E.HONEY); put(w, 199, FLOOR - 1, E.FIRE);
  run(w, 30); assert.ok(count(w, E.AMBER) > 0, 'fire sets honey to amber');
  w = world(); box(w, 200, FLOOR - 2, 210, FLOOR - 1, E.AMBER); box(w, 211, FLOOR - 2, 214, FLOOR - 1, E.LAVA);
  run(w, 60); assert.ok(count(w, E.HONEY) > 0, 'lava melts amber back to honey');
});

test('mites drink honey and multiply', () => {
  const w = world(3);
  box(w, 150, FLOOR - 3, 250, FLOOR - 1, E.HONEY);
  for (let x = 152; x < 250; x += 6) put(w, x, FLOOR - 4, E.MITE);
  const m0 = count(w, E.MITE);
  run(w, 300); assert.ok(count(w, E.MITE) > m0, `mites ${m0} -> ${count(w, E.MITE)}`);
});

test('fungus and spores: wet wood by mud rots to fungus, fungus sheds spores, spores seed wood', () => {
  let w = world(2);
  box(w, 200, FLOOR - 4, 220, FLOOR - 1, E.WOOD); box(w, 200, FLOOR - 5, 220, FLOOR - 5, E.MUD);
  run(w, 2400); assert.ok(count(w, E.FUNGUS) > 0, 'fungus grows on wood beside mud');
  w = world(2); box(w, 200, FLOOR - 4, 220, FLOOR - 1, E.FUNGUS);
  let spores = 0; for (let t = 0; t < 1200 && !spores; t++) { run(w, 1); spores = count(w, E.SPORE); }
  assert.ok(spores > 0, 'fungus sheds spores');
  w = world(2); box(w, 200, FLOOR - 4, 220, FLOOR - 1, E.WOOD); box(w, 200, FLOOR - 9, 220, FLOOR - 5, E.SPORE);
  run(w, 300); assert.ok(count(w, E.FUNGUS) > 0, 'spores seed fungus on wood');
});

test('a spore cloud near fire goes off like dust', () => {
  const w = world();
  box(w, 200, 150, 240, 170, E.SPORE); put(w, 199, 160, E.FIRE);
  let blasts = 0; for (let t = 0; t < 60; t++) blasts += w.advanceTicks(1).filter(e => e.t === 'blast').length;
  assert.ok(blasts >= 3, `dust blasts: ${blasts}`);
});

test('fireflies: aether at a bloom wakes one; fireflies pollinate blooms and drown in water', () => {
  let w = world();
  box(w, 200, FLOOR - 1, 210, FLOOR - 1, E.BLOOM); put(w, 205, FLOOR - 2, E.AETHER);
  run(w, 2); assert.ok(count(w, E.FIREFLY) > 0, 'a firefly wakes');
  w = world(6); box(w, 150, FLOOR - 1, 250, FLOOR - 1, E.BLOOM);
  for (let x = 152; x < 250; x += 8) put(w, x, FLOOR - 3, E.FIREFLY);
  run(w, 1800); assert.ok(count(w, E.SEED) + count(w, E.PLANT) > 0, 'pollinated seeds');
  w = world(); box(w, 150, FLOOR - 10, 250, FLOOR - 1, E.WATER); put(w, 200, FLOOR - 5, E.FIREFLY);
  run(w, 5); assert.equal(count(w, E.FIREFLY), 0, 'drowned');
});

test('coral: moss in brine becomes coral, coral grows through brine, acid salts it', () => {
  let w = world();
  box(w, 199, FLOOR - 12, 199, FLOOR - 1, E.STONE); box(w, 241, FLOOR - 12, 241, FLOOR - 1, E.STONE);
  box(w, 200, FLOOR - 10, 240, FLOOR - 1, E.BRINE); box(w, 215, FLOOR - 1, 220, FLOOR - 1, E.MOSS);
  run(w, 600); const c = count(w, E.CORAL);
  assert.ok(c > 0, 'coral formed');
  run(w, 1800); assert.ok(count(w, E.CORAL) > c, 'coral grew');
  w = world(); box(w, 200, FLOOR - 1, 210, FLOOR - 1, E.CORAL); put(w, 205, FLOOR - 2, E.ACID);
  run(w, 4); assert.ok(count(w, E.SALT) > 0, 'acid salts coral');
});

test('pumice: lava froths salt into pumice; pumice floats on water; acid grinds it to sand', () => {
  let w = world();
  box(w, 200, FLOOR - 2, 210, FLOOR - 1, E.LAVA); box(w, 200, FLOOR - 4, 210, FLOOR - 3, E.SALT);
  run(w, 4); assert.ok(count(w, E.PUMICE) > 0, 'pumice formed');
  w = world(); box(w, 199, FLOOR - 20, 199, FLOOR - 1, E.STONE); box(w, 221, FLOOR - 20, 221, FLOOR - 1, E.STONE);
  box(w, 200, FLOOR - 10, 220, FLOOR - 1, E.WATER); box(w, 205, FLOOR - 9, 215, FLOOR - 8, E.PUMICE);
  run(w, 400); const s = w.inspect(); let top = 0;
  for (let i = 0; i < s.cells.length; i++) if (s.cells[i] === E.PUMICE && ((i / E.W) | 0) <= FLOOR - 9) top++;
  assert.ok(top >= 18, `pumice rafts at the surface: ${top}`);
  w = world(); box(w, 200, FLOOR - 1, 210, FLOOR - 1, E.PUMICE); put(w, 205, FLOOR - 2, E.ACID);
  run(w, 4); assert.ok(count(w, E.SAND) > 0, 'acid grinds pumice to sand');
});
