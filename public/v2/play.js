import { createEngine, AIR, STONE, WATER, WOOD, SAND, SEED } from './alembic-engine-v2.js';
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
