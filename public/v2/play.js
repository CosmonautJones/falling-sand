import { createEngine, AIR, STONE, WATER, WOOD, SAND, SEED, BRICK, POWDER, TNT } from './alembic-engine-v2.js';
import { clampView } from './camera.js';

// A composed toy made entirely from ordinary materials and existing operations.
// Keeping it out of the simulation preserves old checkpoints and free-play physics.
export function createDamCheckpoint() {
  const engine = createEngine({ scene: 'empty', seed: 0xda77 });
  const world = engine.inspect();
  const rect = (x0, y0, x1, y1, m) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) world.setc(x, y, m, ((x * 7 + y * 11) % 9) - 4);
  };
  // Raised reservoir. The warm wooden seam is only five grains thick.
  rect(216, 48, 220, 118, STONE);
  rect(308, 48, 312, 118, STONE);
  rect(216, 112, 312, 118, STONE);
  rect(222, 112, 306, 116, WOOD);
  rect(222, 117, 306, 118, AIR);
  rect(221, 62, 307, 111, WATER);
  // A roof splits the falling stream; broad shelves catch and spill it again.
  world.paintLine(264, 140, 232, 169, 2, STONE);
  world.paintLine(264, 140, 296, 169, 2, STONE);
  rect(208, 170, 212, 187, STONE);
  rect(208, 184, 244, 188, STONE);
  rect(288, 201, 320, 205, STONE);
  rect(316, 187, 320, 205, STONE);
  // Catch basin and two dry seed beds: the flood leaves a little garden behind.
  rect(204, 247, 324, 253, STONE);
  rect(204, 223, 208, 253, STONE);
  rect(320, 223, 324, 253, STONE);
  rect(216, 242, 239, 246, SAND);
  rect(289, 242, 312, 246, SAND);
  for (const x of [220, 227, 234, 293, 300, 307]) rect(x, 241, x, 241, SEED);
  return engine.checkpoint();
}

export function damView(l) {
  const zoom = Math.min(l.width / (l.worldWidth * 128 / 480), l.height / (l.worldHeight * 224 / 270));
  return clampView(l, {
    zoom,
    panX: l.width / 2 - 264 / 480 * l.worldWidth * zoom,
    panY: l.height / 2 - 150 / 270 * l.worldHeight * zoom,
  });
}

// Ordinary powder, casks and combustible supports. The player supplies every spark.
export function createFuseCheckpoint() {
  const engine = createEngine({ scene: 'empty', seed: 0xf053 });
  const world = engine.inspect();
  const rect = (x0, y0, x1, y1, m) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) world.setc(x, y, m, ((x * 7 + y * 11) % 9) - 4);
  };
  // Three supported fuses. Cut a gap, light either end, or start on a different tier.
  for (const y of [94, 152, 211]) {
    rect(208, y, 316, y + 3, BRICK);
    rect(212, y - 3, 312, y - 1, POWDER);
  }
  rect(209, 90, 211, 151, WOOD);
  rect(313, 90, 315, 151, WOOD);
  rect(262, 148, 266, 210, WOOD);
  const cask = (x, y) => {
    rect(x - 5, y - 6, x + 5, y + 2, WOOD);
    rect(x - 3, y - 5, x + 3, y + 1, TNT);
  };
  cask(216, 92); cask(304, 92);
  cask(264, 150);
  cask(226, 209); cask(300, 209);
  // Loose sand catches the shock; the pool turns the falling embers into steam.
  rect(198, 246, 326, 251, BRICK);
  rect(198, 228, 202, 251, BRICK);
  rect(322, 228, 326, 251, BRICK);
  rect(203, 238, 321, 245, SAND);
  rect(245, 238, 281, 245, WATER);
  return engine.checkpoint();
}

export function fuseView(l) {
  const zoom = Math.min(l.width / (l.worldWidth * 140 / 480), l.height / (l.worldHeight * 224 / 270));
  return clampView(l, {
    zoom,
    panX: l.width / 2 - 262 / 480 * l.worldWidth * zoom,
    panY: l.height / 2 - 150 / 270 * l.worldHeight * zoom,
  });
}
