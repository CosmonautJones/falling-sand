import {
  W,
  H,
  AIR,
  WATER,
  STONE,
  BRICK,
  WOOD,
  PLANT,
  BLOOM,
  FIRE,
  EMBER,
  ASH,
  MUD,
  LAVA,
  SMOKE,
} from '../v2/engine/world.js';
import { createRandom } from '../v2/engine/random.js';

export const PATCHES = W / 8;
export const ECO_TICKS = 30;
const living = (m) => m === PLANT || m === BLOOM;
const ground = (m) => m === STONE || m === BRICK;
const shapes = Object.fromEntries(
  ['clover', 'reed', 'fireflower'].map((kind) => {
    const points = [];
    const height = kind === 'reed' ? 26 : kind === 'fireflower' ? 19 : 14;
    for (let y = 1; y <= height; y++) {
      points.push([0, -y, y === height && kind !== 'reed']);
      if (y > 3 && y % 3 === 0) {
        const side = y % 2 ? -1 : 1;
        points.push([side, -y, false], [side * 2, -y - 1, kind === 'clover']);
      }
    }
    if (kind !== 'reed')
      points.push([-1, -height, true], [1, -height, true], [0, -height - 1, true]);
    return [kind, points];
  }),
);

/** Surface-soil toy. Every live node holds one nutrient unit; water units are absorbed grains. */
export function createEcology({ world, surface, seed }) {
  const rng = createRandom(seed ^ 0x51ed270b);
  let state = {
    water: Array(PATCHES).fill(0),
    nutrients: Array(PATCHES).fill(48),
    litter: Array(PATCHES).fill(0),
    seeds: Array(PATCHES).fill(3),
    burn: Array(PATCHES).fill(0),
    light: Array(PATCHES).fill(255),
    plants: Array(PATCHES).fill(null),
    steps: 0,
    absorbed: 0,
    spentWater: 0,
  };
  function anchor(q) {
    const x = q * 8 + 4;
    for (let y = surface[x]; y < H; y++) if (ground(world.cells[y * W + x])) return { x, y };
    return { x, y: H };
  }
  function sunlight(x, y, own) {
    let light = 255;
    for (let py = 0; py < y && light; py++) {
      const i = py * W + x,
        m = world.cells[i];
      if (ground(m) || m === WOOD) return 0;
      if (living(m) && !own?.includes(i)) light = Math.max(0, light - 20);
      if (m === WATER || m === SMOKE) light = Math.max(0, light - 2);
    }
    return light;
  }
  function retire(q, plant) {
    for (const i of plant.nodes) {
      if (living(world.cells[i])) world.setc(i % W, Math.floor(i / W), AIR, 0);
      state.litter[q]++;
    }
    state.plants[q] = null;
  }
  // Grain reactions and user edits can ignite and quench between slower soil steps.
  // Record that provenance immediately; the resource debit still occurs in step().
  function observeFire() {
    for (let q = 0; q < PATCHES; q++) {
      const plant = state.plants[q];
      if (!plant) continue;
      for (const i of plant.nodes) {
        const m = world.cells[i];
        if (!living(m) && ([FIRE, EMBER, ASH, LAVA].includes(m) || world.heat[i] >= 62)) {
          state.burn[q] = 120;
          break;
        }
      }
    }
  }
  function step() {
    state.steps++;
    const { water, nutrients, litter, seeds, burn, light, plants } = state;
    // Alternating conservative pair transfers, independent of presentation frames.
    for (let q = state.steps % 2; q < PATCHES - 1; q += 2) {
      const flow = Math.trunc((water[q] - water[q + 1]) / 8);
      water[q] -= flow;
      water[q + 1] += flow;
    }
    for (let q = 0; q < PATCHES; q++) {
      if (burn[q]) burn[q]--;
      const root = anchor(q);
      let plant = plants[q];
      let damaged = false;
      light[q] = sunlight(root.x, root.y - 1, plant?.nodes);
      if (root.y >= H) {
        if (plant) retire(q, plant);
        continue;
      }
      // Uptake is bounded to eight nearby grains per half-second, not a full-grid scan.
      let taken = 0;
      for (let dy = 1; dy <= 6 && taken < 8 && water[q] < 80; dy++) {
        for (let dx = -3; dx <= 3 && taken < 8 && water[q] < 80; dx++) {
          const x = root.x + dx,
            y = root.y - dy;
          if (y >= 0 && world.cells[y * W + x] === WATER) {
            world.setc(x, y, AIR, 0);
            water[q]++;
            state.absorbed++;
            taken++;
          }
        }
      }
      if (plant) {
        const survivors = [];
        for (const i of plant.nodes) {
          if (living(world.cells[i])) survivors.push(i);
          else {
            damaged = true;
            litter[q]++;
            if ([FIRE, EMBER, ASH, LAVA].includes(world.cells[i]) || world.heat[i] >= 62)
              burn[q] = 120;
          }
        }
        plant.nodes = survivors;
        // These are small single-stem organisms: damage retires the whole plant.
        // This prevents a severed canopy from living and propagating in midair.
        if (damaged) {
          retire(q, plant);
          plant = null;
        } else if (root.y !== plant.y || !ground(world.cells[plant.y * W + root.x])) {
          retire(q, plant);
          plant = null;
        }
      }
      const hot = world.heat[(root.y - 1) * W + root.x] >= 62;
      // Wet litter slowly returns its invested nutrient units to the soil.
      if (state.steps % 4 === 0 && water[q] > 0 && litter[q] > 0) {
        litter[q]--;
        nutrients[q]++;
      }
      if (!plant && !damaged && seeds[q] > 0 && water[q] >= 4 && light[q] >= 80 && !hot) {
        const i = (root.y - 1) * W + root.x;
        if ([AIR, ASH, MUD].includes(world.cells[i])) {
          const submerged = world.cells[(root.y - 3) * W + root.x] === WATER;
          const kind = burn[q] ? 'fireflower' : submerged || water[q] >= 32 ? 'reed' : 'clover';
          seeds[q]--;
          water[q] -= 2;
          state.spentWater += 2;
          world.setc(root.x, root.y - 1, PLANT, rng.int(15) - 7);
          plants[q] = { x: root.x, y: root.y, kind, stage: 1, dry: 0, nodes: [i] };
        }
        // Germination and later growth are distinct ecological steps.
      } else if (plant) {
        plant.dry = water[q] === 0 || hot ? plant.dry + 1 : Math.max(0, plant.dry - 1);
        if (plant.dry >= 20) {
          retire(q, plant);
        } else if (!hot && light[q] >= 80 && water[q] >= 2 && nutrients[q] > 0) {
          const shape = shapes[plant.kind];
          // Two connected grains per step keeps the feedback readable in seconds.
          for (
            let n = 0;
            n < 2 && plant.stage < shape.length && water[q] >= 2 && nutrients[q] > 0;
            n++
          ) {
            const [dx, dy, flower] = shape[plant.stage];
            const x = plant.x + dx,
              y = plant.y + dy,
              i = y * W + x;
            if (y < 0) break;
            if (world.cells[i] === ASH || world.cells[i] === MUD) world.setc(x, y, AIR, 0);
            // Aquatic stems displace one counted water grain rather than destroying it.
            if (plant.kind === 'reed' && world.cells[i] === WATER && water[q] < 80) {
              world.setc(x, y, AIR, 0);
              water[q]++;
              state.absorbed++;
            }
            if (world.cells[i] !== AIR) break;
            world.setc(x, y, flower ? BLOOM : PLANT, rng.int(15) - 7);
            plant.nodes.push(i);
            plant.stage++;
            nutrients[q]--;
            water[q] -= 2;
            state.spentWater += 2;
          }
          // New seeds are paid for, and stored in a neighbor's dormant bank.
          if (plant.stage === shape.length && state.steps % 12 === 0 && nutrients[q] > 0) {
            const next = Math.max(0, Math.min(PATCHES - 1, q + (rng.int(2) ? 1 : -1)));
            if (seeds[next] < 8) {
              seeds[next]++;
              nutrients[q]--;
            }
          }
        }
      }
      if (state.steps % 12 === 0 && light[q] >= 80 && water[q] > 0) {
        water[q]--;
        state.spentWater++;
      }
    }
  }
  function stats() {
    let plantGrains = 0,
      wetPatches = 0,
      nutrientUnits = 0,
      flowers = 0;
    for (let q = 0; q < PATCHES; q++) {
      const plant = state.plants[q];
      const n = plant?.nodes.length ?? 0;
      plantGrains += n;
      wetPatches += state.water[q] > 0;
      flowers += !!plant && plant.kind === 'fireflower';
      nutrientUnits += state.nutrients[q] + state.litter[q] + state.seeds[q] + n;
    }
    return {
      plantGrains,
      wetPatches,
      nutrientUnits,
      flowers,
      absorbed: state.absorbed,
      spentWater: state.spentWater,
    };
  }
  return {
    step,
    observeFire,
    stats,
    anchor,
    inspect: () => state,
    capture: () => ({ ...structuredClone(state), random: rng.captureState() }),
    restore(next) {
      const copy = validateEcology(next);
      const { random, ...fields } = copy;
      state = fields;
      rng.reset(random);
    },
  };
}

export function validateEcology(input) {
  const fail = () => {
    throw new Error('Invalid valley ecology');
  };
  if (!input || typeof input !== 'object') fail();
  const state = structuredClone(input);
  const int = (v, min, max) => {
    if (!Number.isSafeInteger(v) || v < min || v > max) fail();
  };
  const limits = {
    water: 80,
    nutrients: 10000,
    litter: 10000,
    seeds: 10000,
    burn: 120,
    light: 255,
  };
  const keys = [...Object.keys(limits), 'plants', 'steps', 'absorbed', 'spentWater', 'random'];
  if (Object.keys(state).length !== keys.length || keys.some((k) => !Object.hasOwn(state, k)))
    fail();
  for (const [key, max] of Object.entries(limits)) {
    if (!Array.isArray(state[key]) || state[key].length !== PATCHES) fail();
    for (const v of state[key]) int(v, 0, max);
  }
  for (const key of ['steps', 'absorbed', 'spentWater'])
    int(state[key], 0, Number.MAX_SAFE_INTEGER);
  int(state.random, 0, 0xffffffff);
  if (!Array.isArray(state.plants) || state.plants.length !== PATCHES) fail();
  const owned = new Set();
  for (let q = 0; q < PATCHES; q++) {
    const plant = state.plants[q];
    if (plant === null) continue;
    if (
      !plant ||
      Object.keys(plant).sort().join() !== 'dry,kind,nodes,stage,x,y' ||
      !Object.hasOwn(shapes, plant.kind)
    )
      fail();
    int(plant.x, q * 8 + 4, q * 8 + 4);
    int(plant.y, 1, H - 1);
    int(plant.dry, 0, 19);
    int(plant.stage, 1, shapes[plant.kind].length);
    if (!Array.isArray(plant.nodes) || plant.nodes.length === 0 || plant.nodes.length > plant.stage)
      fail();
    const allowed = new Set(
      shapes[plant.kind].slice(0, plant.stage).map(([dx, dy]) => (plant.y + dy) * W + plant.x + dx),
    );
    for (const i of plant.nodes) {
      int(i, 0, W * H - 1);
      if (owned.has(i) || !allowed.has(i)) fail();
      owned.add(i);
    }
  }
  return state;
}
