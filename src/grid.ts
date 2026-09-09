import { Material, SHADE_RANGE, type MaterialId } from './materials';
import { randShade } from './rng';

/**
 * Dense cell grid backed by a flat Uint8Array of material ids.
 *
 * Out-of-bounds reads return Stone so edge handling in the simulation can stay
 * branch-light: the world behaves as if enclosed in an immovable box.
 *
 * `shades` is a persistent per-cell RGB offset rolled at paint time and moved
 * by `swap` with the grain, so settled piles read as textured sand art.
 */
export class Grid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;
  readonly shades: Int8Array;

  constructor(width: number, height: number) {
    if (!Number.isInteger(width) || width <= 0) {
      throw new RangeError(`width must be a positive integer, got ${width}`);
    }
    if (!Number.isInteger(height) || height <= 0) {
      throw new RangeError(`height must be a positive integer, got ${height}`);
    }
    this.width = width;
    this.height = height;
    this.cells = new Uint8Array(width * height);
    this.shades = new Int8Array(width * height);
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  get(x: number, y: number): MaterialId {
    if (!this.inBounds(x, y)) return Material.Stone;
    return this.cells[this.index(x, y)] as MaterialId;
  }

  getShade(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    return this.shades[this.index(x, y)];
  }

  set(x: number, y: number, material: MaterialId, shade = 0): void {
    if (!this.inBounds(x, y)) return;
    const i = this.index(x, y);
    this.cells[i] = material;
    this.shades[i] = shade;
  }

  swap(ax: number, ay: number, bx: number, by: number): void {
    if (!this.inBounds(ax, ay) || !this.inBounds(bx, by)) return;
    const a = this.index(ax, ay);
    const b = this.index(bx, by);
    const tmp = this.cells[a] as number;
    this.cells[a] = this.cells[b] as number;
    this.cells[b] = tmp;
    const shade = this.shades[a];
    this.shades[a] = this.shades[b];
    this.shades[b] = shade;
  }

  /** Paint a filled circle of `material` centred on (cx, cy). */
  paint(cx: number, cy: number, radius: number, material: MaterialId): void {
    const r2 = radius * radius;
    const amplitude = SHADE_RANGE[material];
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, material, randShade(amplitude));
      }
    }
  }

  /** Stamp `paint` on every cell of a Bresenham line so a fast stroke cannot skip. */
  paintLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    radius: number,
    material: MaterialId,
  ): void {
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      this.paint(x, y, radius, material);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  clear(): void {
    this.cells.fill(Material.Air);
    this.shades.fill(0);
  }

  /** Count of cells holding `material`. Used by tests to assert conservation. */
  count(material: MaterialId): number {
    let n = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === material) n++;
    }
    return n;
  }

  /** Presence mask, one byte per material id. One scan instead of N counts. */
  occupancy(): Uint8Array {
    const seen = new Uint8Array(256);
    for (let i = 0; i < this.cells.length; i++) seen[this.cells[i]] = 1;
    return seen;
  }
}
