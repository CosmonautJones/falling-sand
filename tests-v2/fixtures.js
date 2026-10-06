import { createWorld, W, H, SAND, WATER, STONE, OIL, MUD, SEED, CLOUD } from '../public/v2/engine/world.js';
import { createRandom } from '../public/v2/engine/random.js';

export const SCENES = Object.freeze(['settled', 'falling', 'wet', 'storm']);
export const DEFAULT_SEED = 0xa341316c;

// Fixture version 1: finite setup and commands, no render or wall-clock input.
// Each call owns a new 480x270 world and starts at committed tick zero.
export function createFixture({ scene = 'settled', seed = DEFAULT_SEED } = {}) {
  if (!SCENES.includes(scene)) throw new Error(`Unknown fixture scene: ${scene}`);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Fixture seed must be a uint32');
  const world = createWorld({ scene: 'empty', seed });
  const layout = createRandom(seed ^ 0x51ed270b);
  const box = (x0, y0, x1, y1, m) => world.applyOperation({ t: 'box', x0, y0, x1, y1, m });
  box(0, H - 4, W - 1, H - 1, STONE);

  if (scene === 'settled') {
    // A flat powder bed supported by the floor; decorative shades remain seeded.
    box(0, H - 34, W - 1, H - 5, SAND);
  } else if (scene === 'falling') {
    for (let i = 0; i < 8; i++) {
      const x = 20 + i * 56 + layout.int(12);
      const y = 20 + layout.int(40);
      box(x, y, x + 23, y + 29, SAND);
    }
    // 24 bounded pours keep this workload falling through all 720 benchmark ticks.
    // Scheduled edits are part of the measured tick, and never come from the host.
    const commands = [];
    for (let tick = 1; tick <= 720; tick += 30) {
      commands.push({ tick, sequence: 0, op: {
        t: 'p', x: 30 + layout.int(W - 60), y: 20, r: 10, m: SAND,
        vx: layout.int(7) - 3, vy: 1,
      } });
    }
    world.advanceTicks(0, commands);
  } else {
    // A contained pool exercises liquid dispersion, buoyancy and wet reactions.
    box(30, 120, 33, H - 5, STONE);
    box(W - 34, 120, W - 31, H - 5, STONE);
    box(34, 195, W - 35, H - 5, WATER);
    box(34, 180, W - 35, 194, OIL);
    box(150, H - 14, 190, H - 5, MUD);
    for (let i = 0; i < 24; i++) {
      world.applyOperation({ t: 'p', x: 140 + layout.int(70), y: 220 + layout.int(30), r: 1, m: SEED });
    }
    if (scene === 'storm') {
      box(100, 20, W - 101, 25, CLOUD);
      world.applyOperation({ t: 'tempest' });
    }
  }
  return world;
}
