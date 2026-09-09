import { Grid } from './grid';
import { Material, MATERIALS, type MaterialId } from './materials';
import { Stage } from './stage';

function clampByte(n: number): number {
  if (n < 0) return 0;
  if (n > 255) return 255;
  return n;
}

export function rgbFor(material: MaterialId, shade: number): [number, number, number] {
  const [r, g, b] = MATERIALS[material].color;
  return [clampByte(r + shade), clampByte(g + shade), clampByte(b + shade)];
}

function isAir(id: number): boolean {
  return id === Material.Air;
}

/**
 * Fill a packed RGBA buffer, one pixel per cell.
 * Optional `tick` drives fire flicker and water shimmer; 0 is stable for tests.
 * Neighbor occlusion darkens settled piles so dunes read as volume, not flat fill.
 */
export function blitGrid(grid: Grid, data: Uint8ClampedArray, tick = 0): void {
  const { cells, shades, heat, width, height } = grid;
  for (let i = 0; i < cells.length; i++) {
    const mat = cells[i] as MaterialId;
    let [r, g, b] = rgbFor(mat, shades[i]);
    const x = i % width;
    const y = (i / width) | 0;

    if (
      mat !== Material.Air &&
      mat !== Material.Fire &&
      mat !== Material.Glass &&
      mat !== Material.Crystal &&
      mat !== Material.Steam &&
      mat !== Material.Aether &&
      mat !== Material.Azoth &&
      mat !== Material.Void &&
      mat !== Material.Rift
    ) {
      let ao = 0;
      if (y + 1 < height && !isAir(cells[i + width])) ao += 4;
      if (x > 0 && !isAir(cells[i - 1])) ao += 3;
      if (x + 1 < width && !isAir(cells[i + 1])) ao += 3;
      if (y > 0 && !isAir(cells[i - width])) ao += 2;
      if (ao) {
        r = clampByte(r - ao);
        g = clampByte(g - ao);
        b = clampByte(b - ao);
      }
    }

    if (mat === Material.Fire && tick !== 0) {
      const pulse = ((i * 13 + tick * 9) & 15) - 5;
      r = clampByte(r + pulse + 6);
      g = clampByte(g + pulse);
      b = clampByte(b - 6);
    }

    if ((mat === Material.Lava || mat === Material.Ember) && tick !== 0) {
      const pulse = ((i * 17 + tick * 11) & 15) - 5;
      r = clampByte(r + pulse + 8);
      g = clampByte(g + pulse);
      b = clampByte(b - 4);
    }

    if (mat === Material.Water && tick !== 0) {
      const wiggle = ((i + (tick >> 2)) & 3) - 1;
      g = clampByte(g + wiggle);
      b = clampByte(b + wiggle + 1);
    }

    if (mat === Material.Steam && tick !== 0) {
      const wisp = ((i * 7 + (tick >> 2) * 3) & 3) - 1;
      r = clampByte(r + wisp);
      g = clampByte(g + wisp);
      b = clampByte(b + wisp + 1);
    }

    if (mat === Material.Rift && tick !== 0) {
      const pulse = ((i * 11 + tick * 6) & 15) - 4;
      r = clampByte(r + pulse + 8);
      b = clampByte(b + pulse + 14);
    }

    if ((mat === Material.Aether || mat === Material.Azoth) && tick !== 0) {
      const pulse = ((i * 19 + tick * 7) & 15) - 4;
      r = clampByte(r + pulse + (mat === Material.Azoth ? 10 : 0));
      g = clampByte(g + pulse);
      b = clampByte(b + pulse + 8);
    }

    if (mat === Material.Gold && tick !== 0) {
      const spark = ((i * 29 + tick * 5) & 15) - 4;
      r = clampByte(r + spark + 10);
      g = clampByte(g + spark + 4);
      b = clampByte(b - 4);
    }

    if (mat === Material.Tnt && ((x + y) & 2) === 0) {
      r = clampByte(236);
      g = clampByte(214);
      b = clampByte(168);
    }

    if (mat === Material.Mite && shades[i] >= 64) {
      r = clampByte(r + 36);
      g = clampByte(g + 18);
      b = clampByte(b - 8);
    }

    if (mat === Material.Minnow && tick !== 0) {
      const dart = ((i * 11 + (tick >> 1) * 5) & 7) - 3;
      g = clampByte(g + dart + 4);
      b = clampByte(b + dart + 6);
    }

    if (mat === Material.Bloom && tick !== 0) {
      const pulse = ((i * 17 + tick * 3) & 15) - 4;
      r = clampByte(r + pulse + 8);
      b = clampByte(b + pulse);
    }

    const temp = heat[i];
    if (temp > 64 && mat !== Material.Fire && mat !== Material.Lava && mat !== Material.Ember) {
      const q = (temp - 64) >> 3;
      r = clampByte(r + q);
      b = clampByte(b - (q >> 1));
    }

    if (mat === Material.Pearl && (y === 0 || isAir(cells[i - width]))) {
      r = clampByte(r + 24);
      g = clampByte(g + 20);
      b = clampByte(b + 16);
    }

    if (mat === Material.Acid && tick !== 0) {
      const sting = ((i + tick * 2) & 7) - 3;
      g = clampByte(g + sting + 4);
      r = clampByte(r + sting);
    }

    if (mat === Material.Mercury && (y === 0 || isAir(cells[i - width]))) {
      r = clampByte(r + 28);
      g = clampByte(g + 28);
      b = clampByte(b + 24);
    }

    if (
      (mat === Material.Glass || mat === Material.Crystal || mat === Material.Azoth) &&
      (y === 0 || isAir(cells[i - width]))
    ) {
      r = clampByte(r + 22);
      g = clampByte(g + 18);
      b = clampByte(b + 16);
    }

    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  }
}

/** Blits the grid, then presents it through the Three.js (or 2d) stage. */
export class Renderer {
  private readonly data: Uint8ClampedArray;
  private readonly grid: Grid;
  private readonly stage: Stage;
  private tick = 0;
  private wonder = 0;
  private shake = 0;
  private readonly still: boolean;

  constructor(canvas: HTMLCanvasElement, grid: Grid) {
    this.grid = grid;
    this.data = new Uint8ClampedArray(grid.width * grid.height * 4);
    this.stage = new Stage(canvas, grid);
    this.still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  draw(): void {
    if (!this.still) this.tick++;
    const tick = this.still ? 0 : this.tick;
    blitGrid(this.grid, this.data, tick);
    this.stage.present(this.data, this.still ? 0 : 1, this.wonder, this.still ? 0 : this.shake);
    this.shake *= 0.78;
    if (this.shake < 0.012) this.shake = 0;
  }

  setWonder(on: boolean): void {
    this.wonder = on ? 1 : 0;
  }

  kick(amount: number): void {
    if (this.still) return;
    this.shake = Math.min(1, this.shake + amount);
  }
}
