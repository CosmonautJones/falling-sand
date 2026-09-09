import { Grid } from './grid';
import { Material, SHADE_RANGE, type MaterialId } from './materials';
import { randShade } from './rng';

export const WIDTH = 480;
export const HEIGHT = 270;
export const BRUSH_SIZES = [1, 3, 6, 12, 22] as const;

function grain(id: MaterialId): number {
  return randShade(SHADE_RANGE[id]);
}

function fill(grid: Grid, x0: number, y0: number, x1: number, y1: number, id: MaterialId): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      grid.set(x, y, id, grain(id));
    }
  }
}

/**
 * Charge a playfield with a scene so the vessel is never an empty box.
 * Layout is proportional so tests can use the shipped size or a smaller grid.
 */
export function seedVessel(grid: Grid): void {
  const w = grid.width;
  const h = grid.height;
  const floorN = Math.max(3, Math.round(h * 0.018));
  const wallN = Math.max(3, Math.round(w * 0.01));
  const ground = h - floorN;

  fill(grid, 0, ground, w - 1, h - 1, Material.Stone);
  fill(grid, 0, 0, wallN - 1, h - 1, Material.Stone);
  fill(grid, w - wallN, 0, w - 1, h - 1, Material.Stone);

  const sandX = Math.round(w * 0.22);
  const sandR = Math.max(8, Math.round(w * 0.048));
  grid.paint(sandX, ground - 1, sandR, Material.Sand);
  grid.paint(sandX + sandR, ground - 1, Math.round(sandR * 0.55), Material.Sand);
  grid.set(sandX - 8, ground - sandR - 2, Material.Seed, grain(Material.Seed));
  grid.set(sandX - 5, ground - sandR, Material.Seed, grain(Material.Seed));
  const duneTop = Math.max(1, ground - sandR);
  grid.set(sandX, duneTop + 1, Material.Mite, grain(Material.Mite));
  grid.set(sandX + 3, duneTop + 3, Material.Mite, grain(Material.Mite));
  grid.set(sandX - 2, ground - 3, Material.Mite, grain(Material.Mite));
  grid.set(sandX + 6, ground - 2, Material.Mite, grain(Material.Mite));
  const gx = Math.min(w - wallN - 6, sandX + sandR + 2);
  grid.set(gx, ground - 1, Material.Mud, grain(Material.Mud));
  grid.set(gx + 1, ground - 1, Material.Mud, grain(Material.Mud));
  grid.set(gx, ground - 2, Material.Plant, grain(Material.Plant));
  grid.set(gx + 1, ground - 2, Material.Plant, grain(Material.Plant));
  grid.set(gx + 2, ground - 2, Material.Plant, grain(Material.Plant));
  grid.set(gx + 2, ground - 1, Material.Water, grain(Material.Water));

  const wx0 = Math.round(w * 0.4);
  const wx1 = Math.round(w * 0.56);
  const trough = Math.max(8, Math.round(h * 0.07));
  fill(grid, wx0, ground - trough - 3, wx0, ground - 1, Material.Stone);
  fill(grid, wx1, ground - trough - 3, wx1, ground - 1, Material.Stone);
  fill(grid, wx0 + 1, ground - trough + 1, wx1 - 1, ground - 1, Material.Water);
  const mx = Math.round((wx0 + wx1) / 2);
  grid.set(mx, ground - 2, Material.Minnow, grain(Material.Minnow));
  grid.set(mx + 2, ground - 3, Material.Minnow, grain(Material.Minnow));

  const woodX = Math.round(w * 0.62);
  grid.paint(woodX, ground - 3, Math.max(4, Math.round(w * 0.012)), Material.Wood);
  grid.paint(woodX + 7, ground - 2, Math.max(3, Math.round(w * 0.01)), Material.Wood);
  grid.set(woodX - 8, ground - 1, Material.Tnt, grain(Material.Tnt));
  grid.set(woodX - 7, ground - 1, Material.Tnt, grain(Material.Tnt));

  const iceX = Math.round(w * 0.72);
  grid.paint(iceX, ground - 5, Math.max(7, Math.round(w * 0.022)), Material.Ice);

  const saltX = Math.round(w * 0.12);
  const tableY = ground - Math.max(14, Math.round(h * 0.07));
  fill(grid, saltX - 11, tableY, saltX + 11, tableY + 1, Material.Stone);
  grid.set(saltX - 11, tableY - 1, Material.Stone, grain(Material.Stone));
  grid.set(saltX + 11, tableY - 1, Material.Stone, grain(Material.Stone));
  grid.paint(saltX - 4, tableY - 3, Math.max(3, Math.round(w * 0.01)), Material.Salt);
  grid.paint(saltX + 6, tableY - 3, Math.max(3, Math.round(w * 0.01)), Material.Lead);

  const dish = Math.round(w * 0.32);
  const dishH = Math.max(8, Math.round(h * 0.045));
  fill(grid, dish - 7, ground - 1, dish + 7, ground - 1, Material.Glass);
  fill(grid, dish - 7, ground - dishH, dish - 7, ground - 1, Material.Glass);
  fill(grid, dish + 7, ground - dishH, dish + 7, ground - 1, Material.Glass);
  fill(grid, dish - 6, ground - dishH + 1, dish + 6, ground - 2, Material.Acid);

  const lx = Math.round(w * 0.88);
  const cupW = Math.max(10, Math.round(w * 0.024));
  const cupH = Math.max(14, Math.round(h * 0.06));
  const cupBottom = ground - cupH;
  fill(grid, lx - cupW, cupBottom, lx + cupW, cupBottom, Material.Glass);
  fill(grid, lx - cupW, cupBottom, lx - cupW, ground - 1, Material.Glass);
  fill(grid, lx + cupW, cupBottom, lx + cupW, ground - 1, Material.Glass);
  grid.paint(
    lx,
    ground - Math.max(5, Math.round(cupH * 0.45)),
    Math.max(3, cupW - 7),
    Material.Lava,
  );

  if (w >= 40 && h >= 40) {
    const px = wallN + 6;
    const py = Math.max(8, Math.round(h * 0.22));
    fill(grid, px, py, px + 3, py, Material.Obsidian);
    fill(grid, px, py + 4, px + 3, py + 4, Material.Obsidian);
    fill(grid, px, py, px, py + 4, Material.Obsidian);
    fill(grid, px + 3, py, px + 3, py + 4, Material.Obsidian);
  }
}
