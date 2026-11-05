import * as E from '../engine/world.js';

export const MAX_BLUEPRINT_CELLS = E.W * E.H;
const material = (name, fallback = 'stone') => Math.max(0, E.NAMES.indexOf(name) < 0 ? E.NAMES.indexOf(fallback) : E.NAMES.indexOf(name));
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

export function validateBlueprint(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.format !== 'alembic-blueprint' || value.version !== 1) throw new Error('Choose an Alembic blueprint file.');
  if (!integer(value.width, 1, E.W) || !integer(value.height, 1, E.H)) throw new Error('Blueprint dimensions exceed the vessel.');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 60) throw new Error('Blueprint names need 1–60 characters.');
  if (!Array.isArray(value.cells) || value.cells.length > MAX_BLUEPRINT_CELLS) throw new Error('Blueprint has too many grains.');
  const seen = new Set();
  const cells = value.cells.map(cell => {
    if (!Array.isArray(cell) || cell.length !== 4 || !integer(cell[0], 0, value.width - 1) || !integer(cell[1], 0, value.height - 1) || !integer(cell[2], 1, E.COUNT - 1) || !integer(cell[3], 0, 255)) throw new Error('Blueprint contains an invalid grain.');
    const key = cell[1] * value.width + cell[0];
    if (seen.has(key)) throw new Error('Blueprint contains overlapping grains.');
    seen.add(key);
    return cell.slice();
  });
  if (!cells.length) throw new Error('Blueprint is empty. Select some matter first.');
  return { format: 'alembic-blueprint', version: 1, name: value.name.trim(), width: value.width, height: value.height, cells };
}

export function transformBlueprint(source, turns = 0, mirror = false) {
  const blueprint = validateBlueprint(source);
  turns = ((Math.trunc(turns) % 4) + 4) % 4;
  let { width, height, cells } = blueprint;
  if (mirror) cells = cells.map(([x, y, m, t]) => [width - 1 - x, y, m, t]);
  for (let turn = 0; turn < turns; turn++) {
    cells = cells.map(([x, y, m, t]) => [height - 1 - y, x, m, t]);
    [width, height] = [height, width];
  }
  return validateBlueprint({ ...blueprint, width, height, cells });
}

export function placeBlueprint(world, source, x, y) {
  const blueprint = validateBlueprint(source), sim = world.inspect();
  x = Math.round(x); y = Math.round(y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Choose a location in the vessel.');
  if (x < 0 || y < 0 || x + blueprint.width > sim.W || y + blueprint.height > sim.H) throw new Error('Keep the whole blueprint inside the vessel.');
  for (const [dx, dy, m, temperature] of blueprint.cells) {
    sim.setc(x + dx, y + dy, m, ((dx * 7 + dy * 11) % 9) - 4);
    sim.heat[(y + dy) * sim.W + x + dx] = temperature;
  }
  return blueprint.cells.length;
}

export function captureBlueprint(world, x0, y0, x1, y1, name = 'My invention') {
  const sim = world.inspect();
  for (const n of [x0, y0, x1, y1]) if (!Number.isFinite(n)) throw new Error('Select a rectangle inside the vessel.');
  const left = Math.max(0, Math.min(sim.W - 1, Math.floor(Math.min(x0, x1))));
  const top = Math.max(0, Math.min(sim.H - 1, Math.floor(Math.min(y0, y1))));
  const right = Math.max(left, Math.min(sim.W - 1, Math.floor(Math.max(x0, x1))));
  const bottom = Math.max(top, Math.min(sim.H - 1, Math.floor(Math.max(y0, y1))));
  const cells = [];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const i = y * sim.W + x, m = sim.cells[i];
    if (m !== E.AIR) cells.push([x - left, y - top, m, sim.heat[i]]);
  }
  return validateBlueprint({ format: 'alembic-blueprint', version: 1, name, width: right - left + 1, height: bottom - top + 1, cells });
}

function build(name, width, height, draw) {
  const cells = new Map();
  const dot = (x, y, name, heat = null) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    if (name === 'air') { cells.delete(y * width + x); return; }
    const m = material(name);
    const temperature = heat ?? (name === 'lava' ? 240 : name === 'fire' ? 220 : name === 'ice' ? 14 : name === 'liquid nitrogen' ? 0 : 34);
    cells.set(y * width + x, [x, y, m, temperature]);
  };
  const rect = (x0, y0, x1, y1, name, heat) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) dot(x, y, name, heat); };
  const line = (x0, y0, x1, y1, name, heat) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) dot(Math.round(x0 + (x1 - x0) * k / (n || 1)), Math.round(y0 + (y1 - y0) * k / (n || 1)), name, heat);
  };
  draw({ dot, rect, line });
  return validateBlueprint({ format: 'alembic-blueprint', version: 1, name, width, height, cells: [...cells.values()] });
}

export function builtInBlueprints() {
  return [
    { id: 'townhouse', description: 'Three floors, timber beams, glass windows. Try a spark downstairs.', blueprint: build('Townhouse', 62, 82, ({ rect, line }) => {
      rect(5, 21, 56, 81, 'brick'); rect(9, 25, 52, 78, 'air');
      for (const y of [42, 62, 78]) rect(9, y, 52, y + 1, 'wood');
      for (const y of [29, 49, 68]) for (const x of [15, 36]) rect(x, y, x + 8, y + 8, 'glass');
      rect(27, 67, 34, 81, 'wood');
      for (let y = 0; y < 21; y++) line(31 - y, y, 31 + y, y, 'wood');
      rect(14, 37, 19, 41, 'oil'); rect(39, 57, 44, 61, 'sand');
    }) },
    { id: 'bridge', description: 'A timber truss bridge. Cut the deck or set off a chain reaction.', blueprint: build('Truss bridge', 112, 49, ({ rect, line }) => {
      rect(0, 27, 111, 30, 'wood'); rect(4, 31, 11, 48, 'brick'); rect(100, 31, 107, 48, 'brick');
      for (let x = 5; x < 100; x += 25) for (const offset of [0, 1]) { line(x + offset, 26, x + 12 + offset, 3, 'wood'); line(x + 12 + offset, 3, x + 25 + offset, 26, 'wood'); }
      line(17, 3, 92, 3, 'wood');
      for (let x = 28; x < 90; x += 16) rect(x, 23, x + 3, 26, 'tnt');
    }) },
    { id: 'terrarium', description: 'A miniature living pond with seeds, moss, beetles and minnows.', blueprint: build('Living terrarium', 100, 65, ({ rect, dot }) => {
      rect(0, 0, 2, 64, 'glass'); rect(97, 0, 99, 64, 'glass'); rect(0, 62, 99, 64, 'glass');
      rect(3, 53, 96, 61, 'mud'); rect(54, 36, 96, 52, 'water');
      rect(3, 50, 50, 52, 'sand');
      for (let x = 8; x < 45; x += 9) { dot(x, 49, 'seed'); dot(x + 2, 50, 'moss'); }
      dot(12, 48, 'beetle'); dot(33, 48, 'mite'); dot(68, 43, 'minnow'); dot(83, 47, 'minnow'); dot(49, 49, 'newt');
    }) },
    { id: 'reactor', description: 'Lava meets coolant. Open the thin central valve with the eraser.', blueprint: build('Thermal reactor', 88, 76, ({ rect }) => {
      rect(0, 0, 87, 75, 'obsidian'); rect(4, 4, 83, 71, 'air');
      rect(4, 37, 83, 40, 'glass'); rect(4, 6, 40, 35, 'water'); rect(45, 43, 81, 69, 'lava');
      rect(42, 4, 44, 71, 'glass'); rect(42, 32, 44, 40, 'wood'); rect(4, 69, 40, 71, 'copper');
    }) },
    { id: 'volcano', description: 'A lava core under a loose mountain. Add water for a steam eruption.', blueprint: build('Volcano', 138, 90, ({ rect, line }) => {
      for (let y = 15; y < 89; y++) line(69 - Math.floor(y * .76), y, 69 + Math.floor(y * .76), y, 'sand');
      rect(60, 0, 78, 88, 'air'); rect(56, 68, 82, 88, 'lava'); rect(60, 35, 78, 67, 'lava');
      line(59, 20, 54, 89, 'obsidian'); line(79, 20, 84, 89, 'obsidian'); rect(0, 89, 137, 89, 'stone');
    }) },
    { id: 'magnet', description: 'Ferrofluid gathers toward a suspended magnet. Rotate gravity around it.', blueprint: build('Magnetic fountain', 92, 70, ({ rect }) => {
      rect(0, 0, 2, 69, 'glass'); rect(89, 0, 91, 69, 'glass'); rect(0, 67, 91, 69, 'glass');
      rect(4, 54, 87, 66, 'ferrofluid'); rect(40, 18, 51, 24, 'magnet');
      rect(1, 17, 53, 17, 'steel');
    }) },
    { id: 'cryo', description: 'An icy bath and a warm metal column. Watch the heat lens.', blueprint: build('Cryo chamber', 90, 72, ({ rect }) => {
      rect(0, 1, 2, 71, 'glass'); rect(87, 1, 89, 71, 'glass'); rect(0, 69, 89, 71, 'glass');
      rect(3, 44, 86, 68, 'liquid nitrogen', 0); rect(40, 12, 48, 68, 'copper', 190); rect(10, 16, 26, 24, 'ice');
    }) },
    { id: 'creatures', description: 'A small habitat, not a decorative sprite: these creatures swim and forage.', blueprint: build('Creature habitat', 70, 36, ({ rect, dot }) => {
      rect(0, 29, 69, 35, 'mud'); rect(34, 12, 68, 28, 'water'); rect(68, 11, 69, 35, 'glass');
      rect(8, 25, 20, 28, 'plant'); dot(12, 24, 'mite'); dot(26, 28, 'beetle'); dot(32, 28, 'newt'); dot(46, 20, 'minnow'); dot(57, 23, 'minnow'); dot(17, 10, 'firefly');
    }) },
  ];
}

export function createSetup(world, id = 'chaos') {
  const list = builtInBlueprints(), byId = name => list.find(item => item.id === name).blueprint;
  if (!['chaos', 'volcano', 'biosphere', 'magnetic', 'cryo'].includes(id)) throw new Error('Unknown setup.');
  world.reset({ scene: 'empty', seed: 0xabad1dea });
  world.setGravity({ x: 0, y: 1 });
  const sim = world.inspect();
  for (let y = E.H - 7; y < E.H; y++) for (let x = 0; x < E.W; x++) sim.setc(x, y, E.STONE, (x + y) % 5);
  if (id === 'chaos') {
    placeBlueprint(world, byId('townhouse'), 40, 181);
    placeBlueprint(world, byId('bridge'), 171, 179);
    placeBlueprint(world, byId('magnet'), 341, 193);
    sim.paint(218, 246, 14, E.WATER); sim.paint(146, 35, 15, E.SAND);
    sim.paint(302, 52, 12, material('helium', 'aether'));
  } else if (id === 'volcano') {
    placeBlueprint(world, byId('volcano'), 171, 173);
    placeBlueprint(world, byId('reactor'), 51, 187);
    sim.paint(252, 55, 20, E.WATER);
  } else if (id === 'biosphere') {
    placeBlueprint(world, byId('terrarium'), 70, 198);
    placeBlueprint(world, byId('creatures'), 221, 227);
    placeBlueprint(world, byId('terrarium'), 338, 198);
  } else if (id === 'magnetic') {
    placeBlueprint(world, byId('magnet'), 110, 193);
    placeBlueprint(world, byId('magnet'), 285, 193);
    sim.paint(242, 36, 18, material('ferrofluid', 'mercury'));
  } else {
    placeBlueprint(world, byId('cryo'), 90, 191);
    placeBlueprint(world, byId('reactor'), 285, 187);
  }
}
