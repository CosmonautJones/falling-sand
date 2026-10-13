import {
  createWorld,
  W,
  H,
  AIR,
  WATER,
  BRICK,
  WOOD,
  FIRE,
  PLANT,
  BLOOM,
  EMBER,
  SMOKE,
  STEAM,
} from '../v2/engine/world.js';
import { encodeCheckpoint, decodeCheckpoint, validateCheckpoint } from '../v2/engine/checkpoint.js';
import { createEcology, validateEcology, ECO_TICKS } from './ecology.js';
import { createTerrain, TERRAIN_VERSION } from './terrain.js';

export const SAVE_KEY = 'alembic-living-valley-v1';
export const SAVE_LIMIT = 17 * 1024 * 1024;
const uint = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 0xffffffff;

export function createValley({ seed = 0xc00c17, terrainVersion = TERRAIN_VERSION } = {}) {
  if (!uint(seed)) throw new Error('Invalid valley seed');
  let terrain = createTerrain(seed, terrainVersion);
  const world = createWorld({ seed, scene: 'empty', vegetation: 'managed', ambientEmbers: false, weather: false });
  const sim = world.inspect();
  let valleySeed = seed,
    tick = 0;
  let surface = new Uint16Array(W);
  let ecology;
  const rect = (x0, y0, x1, y1, m) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) sim.setc(x, y, m, ((x * 7 + y * 3) % 9) - 4);
  };
  function generate() {
    surface = terrain.surface;
    for (let x = 0; x < W; x++) {
      // Fired earth is fire-safe; unlike native v2 stone it cannot endlessly fuel a flame.
      for (let py = surface[x]; py < H; py++) sim.setc(x, py, BRICK, ((x * 7 + py * 3) % 9) - 4);
    }
    // Raised spring; a wooden right-hand gate opens onto the descending valley.
    rect(68, 62, 72, 139, BRICK);
    rect(68, 135, 163, 140, BRICK);
    rect(159, 62, 163, 139, WOOD);
    rect(73, 76, 158, 134, WATER);
    // Below the reservoir, the slope catches the flood instead of losing it offscreen.
    ecology = createEcology({ world: sim, surface, seed: valleySeed });
    const soil = ecology.inspect();
    for (let q = 0; q < 9; q++) soil.seeds[q] = 0;
    for (let q = 58; q < 60; q++) soil.seeds[q] = 0;
    // Starting spring moisture is an explicit resource endowment, not hidden respawning.
    for (let q = 9; q < 19; q++) soil.water[q] = 48;
  }
  generate();
  function damIntact() {
    for (let y = 108; y <= 134; y++)
      for (let x = 159; x <= 163; x++) {
        if (sim.cells[y * W + x] !== WOOD) return false;
      }
    return true;
  }
  function checkpoint() {
    const state = world.captureState();
    return {
      format: 'alembic-valley',
      version: 2,
      terrainVersion,
      seed: valleySeed,
      tick,
      surface: Array.from(surface),
      ecology: ecology.capture(),
      world: {
        format: 'alembic-world',
        version: 1,
        width: W,
        height: H,
        tick: state.tickIndex,
        state,
      },
    };
  }
  return {
    inspect: () => ({
      world: sim,
      soil: ecology.inspect(),
      surface,
      tick,
      seed: valleySeed,
      terrainVersion,
      landform: terrain.name,
    }),
    stats: () => ({ ...ecology.stats(), tick, seed: valleySeed, damIntact: damIntact() }),
    advanceTicks(count) {
      if (
        !Number.isSafeInteger(count) ||
        count < 0 ||
        count > 100000 ||
        !Number.isSafeInteger(tick + count)
      )
        throw new Error('Invalid valley ticks');
      for (let i = 0; i < count; i++) {
        world.advanceTicks(1);
        ecology.observeFire();
        tick++;
        if (tick % ECO_TICKS === 0) ecology.step();
      }
    },
    openDam() {
      rect(159, 108, 163, 134, AIR);
    },
    rain() {
      world.applyOperations([{ t: 'rain', m: WATER, n: 700 }]);
    },
    applyTool({ tool, x, y, r = 5 }) {
      if (!['dig', 'water', 'seed', 'fire', 'stone'].includes(tool))
        throw new Error('Unknown valley tool');
      if (
        ![x, y, r].every(Number.isFinite) ||
        x < 0 ||
        x >= W ||
        y < 0 ||
        y >= H ||
        r < 1 ||
        r > 24
      )
        throw new Error('Invalid valley brush');
      x = Math.min(W - 1, Math.round(x));
      y = Math.min(H - 1, Math.round(y));
      r = Math.round(r);
      if (tool === 'seed') {
        const soil = ecology.inspect(),
          q = Math.min(59, Math.floor(x / 8));
        // Each deliberate sow adds one external nutrient-bearing seed, with a hard bank cap.
        if (soil.seeds[q] < 64) soil.seeds[q]++;
      } else if (tool === 'water' || tool === 'fire') {
        for (let py = Math.max(0, y - r); py <= Math.min(H - 1, y + r); py++) {
          for (let px = Math.max(0, x - r); px <= Math.min(W - 1, x + r); px++) {
            if ((px - x) ** 2 + (py - y) ** 2 > r * r) continue;
            const m = sim.cells[py * W + px];
            const eligible =
              tool === 'water'
                ? [AIR, FIRE, EMBER, SMOKE, STEAM].includes(m)
                : [AIR, PLANT, BLOOM, WOOD].includes(m);
            if (eligible)
              sim.setc(px, py, tool === 'water' ? WATER : FIRE, ((px * 7 + py * 3) % 15) - 7);
          }
        }
        if (tool === 'fire') ecology.observeFire();
      } else world.applyOperations([{ t: 'p', x, y, r, m: tool === 'dig' ? AIR : BRICK }]);
    },
    checkpoint,
    restore(input) {
      const prepared = validateValley(input);
      // All fallible schema checks happen before mutating either subsystem.
      world.restore(prepared.world.state);
      valleySeed = prepared.seed;
      terrainVersion = prepared.terrainVersion;
      terrain = createTerrain(valleySeed, terrainVersion);
      tick = prepared.tick;
      surface = Uint16Array.from(prepared.surface);
      ecology = createEcology({ world: sim, surface, seed: valleySeed });
      ecology.restore(prepared.ecology);
    },
    render: world.render,
  };
}

function validateValley(input) {
  const fail = () => {
    throw new Error('Invalid valley checkpoint');
  };
  if (
    !input ||
    input.format !== 'alembic-valley' ||
    ![1, 2].includes(input.version) ||
    !uint(input.seed) ||
    !Number.isSafeInteger(input.tick) ||
    input.tick < 0
  )
    fail();
  const keys =
    input.version === 1
      ? 'ecology,format,seed,surface,tick,version,world'
      : 'ecology,format,seed,surface,terrainVersion,tick,version,world';
  if (Object.keys(input).sort().join() !== keys) fail();
  const terrainVersion = input.version === 1 ? 1 : input.terrainVersion;
  if (![1, 2].includes(terrainVersion)) fail();
  if (!Array.isArray(input.surface) || input.surface.length !== W) fail();
  for (const y of input.surface) if (!Number.isSafeInteger(y) || y < 1 || y >= H) fail();
  const ecology = validateEcology(input.ecology);
  const world = validateCheckpoint(input.world);
  if (world.state.commands.length || world.state.wipe !== -1) fail();
  if (
    input.tick !== world.tick ||
    ecology.steps !== Math.floor(input.tick / ECO_TICKS) ||
    world.state.scene !== 'empty' ||
    world.state.seed !== input.seed
  )
    fail();
  return {
    seed: input.seed,
    terrainVersion,
    tick: input.tick,
    surface: input.surface.slice(),
    ecology,
    world,
  };
}
export function stringifyValley(input) {
  const next = validateValley(input);
  const text = JSON.stringify({
    ...input,
    ...next,
    version: 2,
    world: encodeCheckpoint(next.world),
  });
  if (text.length > SAVE_LIMIT) throw new Error('Valley save exceeds size limit');
  return text;
}
export function parseValley(text) {
  if (
    typeof text !== 'string' ||
    text.length > SAVE_LIMIT ||
    new TextEncoder().encode(text).length > SAVE_LIMIT
  )
    throw new Error('Valley save exceeds size limit');
  const input = JSON.parse(text);
  input.world = decodeCheckpoint(input.world);
  return { ...input, ...validateValley(input), version: 2 };
}
