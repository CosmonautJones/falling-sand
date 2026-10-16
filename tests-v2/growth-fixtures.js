export const GROWTH_SCENES = Object.freeze(['dry', 'shore', 'crowded', 'cargo']);
export const DEFAULT_GROWTH_SEEDS = Object.freeze([73, 991, 2026]);
export const GROWTH_FIXTURE_VERSION = 3;

function requireSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Growth fixture seed must be a uint32');
}

function requireScene(scene) {
  if (!GROWTH_SCENES.includes(scene)) throw new Error(`Unknown growth fixture scene: ${scene}`);
}

function setBox(sim, x0, y0, x1, y1, material, shade = 0) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) sim.setc(x, y, material, shade);
}

function shoreShell(E, sim) {
  setBox(sim, 0, E.H - 12, E.W - 1, E.H - 1, E.STONE);
  setBox(sim, 96, 190, 96, E.H - 13, E.STONE);
  setBox(sim, 324, 190, 324, E.H - 13, E.STONE);
}

// Fixed shallow shore scenes keep all causal material in one bounded basin. They
// intentionally disable climate and ember input so only the ecology can move the
// counts under test.
export function createGrowthFixture(E, { scene = 'shore', seed = DEFAULT_GROWTH_SEEDS[0], vegetation = 'native' } = {}) {
  requireScene(scene); requireSeed(seed);
  if (vegetation !== 'native' && vegetation !== 'managed') throw new Error('Growth fixture vegetation must be native or managed');
  const world = E.createWorld({ seed, scene: 'empty', vegetation, weather: false, ambientEmbers: false });
  const sim = world.inspect();
  shoreShell(E, sim);

  if (scene === 'dry') {
    setBox(sim, 110, 234, 310, 245, E.STONE);
    setBox(sim, 124, 231, 296, 232, E.PLANT);
    setBox(sim, 150, 228, 270, 229, E.BLOOM);
    return world;
  }

  if (scene === 'shore' || scene === 'crowded') {
    setBox(sim, 97, 231, 323, 257, E.WATER);
    if (scene === 'shore') {
      // Freshwater-fed mud is the only living input. There are no initial
      // seeds, plants, or blooms, so any later growth came from this shore.
      // A continuous stone shelf keeps the exposed mud from sliding into the
      // basin while leaving air beside it and freshwater above it.
      setBox(sim, 174, 231, 192, 231, E.STONE);
      for (let x = 176; x <= 190; x += 2) {
        sim.setc(x, 229, E.WATER, 0); sim.setc(x, 230, E.MUD, 0);
        sim.setc(x, 231, E.STONE, 0);
      }
    } else {
      // One exposed mud resource sits at food and freshwater. A finite resource
      // makes unbounded hatching and local crowding observable without a large
      // workload or an exact probability assertion.
      sim.setc(209, 229, E.MITE, 0); sim.setc(210, 229, E.MITE, 0); sim.setc(211, 229, E.MITE, 0);
      sim.setc(210, 230, E.MUD, 0);
      sim.setc(209, 230, E.WATER, 0);
      sim.setc(211, 230, E.PLANT, 0);
      sim.setc(210, 231, E.STONE, 0);
      sim.setc(211, 231, E.AIR, 0);
    }
    return world;
  }

  // Two independent predator pairs exercise both cargo encodings. Minnows eat
  // the mite on their first pass; the death path must spill carried material.
  setBox(sim, 170, 236, 270, 245, E.STONE);
  sim.setc(200, 230, E.MINNOW, 0); sim.setc(201, 230, E.MITE, 90);
  sim.setc(240, 230, E.MINNOW, 0); sim.setc(241, 230, E.MITE, -40);
  return world;
}

export function countMaterial(E, world, material) {
  let count = 0;
  for (const cell of world.inspect().cells) if (cell === material) count++;
  return count;
}

export function growthCounts(E, world) {
  const sim = world.inspect();
  const counts = { water: 0, plant: 0, bloom: 0, seed: 0, mite: 0, ash: 0, mud: 0, gold: 0, goldCarried: 0, goldTotal: 0, beetle: 0, newt: 0, occupied: 0 };
  for (let i = 0; i < sim.cells.length; i++) {
    const material = sim.cells[i];
    if (material !== E.AIR) counts.occupied++;
    if (material === E.WATER) counts.water++;
    else if (material === E.PLANT) counts.plant++;
    else if (material === E.BLOOM) counts.bloom++;
    else if (material === E.SEED) counts.seed++;
    else if (material === E.MITE) { counts.mite++; if (sim.shades[i] >= 64) counts.goldCarried++; }
    else if (material === E.ASH) counts.ash++;
    else if (material === E.MUD) counts.mud++;
    else if (material === E.GOLD) counts.gold++;
    else if (material === E.BEETLE) counts.beetle++;
    else if (material === E.NEWT) counts.newt++;
  }
  counts.goldTotal = counts.gold + counts.goldCarried;
  return counts;
}

export function runGrowthTicks(world, ticks) {
  if (!Number.isSafeInteger(ticks) || ticks < 0) throw new Error('Growth tick count must be a non-negative integer');
  world.advanceTicks(ticks);
  return world;
}
