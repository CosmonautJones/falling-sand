import { W } from '../v2/engine/world.js';
import { createRandom } from '../v2/engine/random.js';

export const TERRAIN_VERSION = 2;

// Terrain is generated once. Its own stream never consumes simulation randomness.
export function createTerrain(seed, version = TERRAIN_VERSION) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || ![1, 2].includes(version))
    throw new Error('Invalid valley terrain');
  const rng = createRandom(seed),
    surface = new Uint16Array(W);
  if (version === 1) {
    const phase = rng.float() * 6.28,
      phase2 = rng.float() * 6.28,
      basin = 208 + rng.int(12);
    for (let x = 0; x < W; x++) {
      const slope = x < 145 ? 113 + x * 0.29 : x < 235 ? 155 + (x - 145) * 0.64 : basin;
      const rise = x > 390 ? (x - 390) * 0.4 : 0;
      surface[x] = Math.min(
        254,
        Math.round(slope - rise + Math.sin(x / 28 + phase) * 5 + Math.sin(x / 9 + phase2) * 2),
      );
    }
    return { surface, name: 'Original valley' };
  }
  const kind = rng.int(3),
    depth = 210 + rng.int(24),
    center = 280 + rng.int(35),
    rim = 177 + rng.int(15),
    phase = rng.float() * Math.PI * 2;
  const profiles = [
    [
      [170, 164],
      [center - 60, depth - 20],
      [center, depth],
      [402, depth - 4],
      [479, rim],
    ],
    [
      [170, 164],
      [245, depth],
      [center + 15, depth - 34],
      [395, depth + 8],
      [479, rim],
    ],
    [
      [170, 164],
      [207, 170],
      [238, depth - 22],
      [center, depth - 22],
      [center + 32, depth + 8],
      [407, depth + 8],
      [479, rim],
    ],
  ];
  const points = profiles[kind];
  let segment = 0;
  for (let x = 0; x < W; x++) {
    let height = 113 + x * 0.3;
    if (x >= 170) {
      while (segment < points.length - 2 && x > points[segment + 1][0]) segment++;
      const [x0, y0] = points[segment],
        [x1, y1] = points[segment + 1],
        t = (x - x0) / (x1 - x0);
      height = y0 + (y1 - y0) * t * t * (3 - 2 * t);
    }
    // Small correlated detail follows the landform rather than independent cell noise.
    surface[x] = Math.round(
      height + Math.sin(x / 26 + phase) * 1.5 + Math.sin(x / 11 + phase) * 0.6,
    );
  }
  return { surface, name: ['Broad basin', 'Twin hollows', 'Stone terraces'][kind] };
}
