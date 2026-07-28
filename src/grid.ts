import { Material, type MaterialId } from './materials';

/**
 * Dense cell grid backed by a flat Uint8Array of material ids.
 *
 * Out-of-bounds reads return Stone so edge handling in the simulation can stay
 * branch-light: the world behaves as if enclosed in an immovable box.
 */
export class Grid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;

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

  set(x: number, y: number, material: MaterialId): void {
    if (!this.inBounds(x, y)) return;
    this.cells[this.index(x, y)] = material;
  }

  swap(ax: number, ay: number, bx: number, by: number): void {
    if (!this.inBounds(ax, ay) || !this.inBounds(bx, by)) return;
    const a = this.index(ax, ay);
    const b = this.index(bx, by);
    const tmp = this.cells[a] as number;
    this.cells[a] = this.cells[b] as number;
    this.cells[b] = tmp;
  }

  /** Paint a filled circle of `material` centred on (cx, cy). */
  paint(cx: number, cy: number, radius: number, material: MaterialId): void {
    const r2 = radius * radius;
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, material);
      }
    }
  }

  clear(): void {
    this.cells.fill(Material.Air);
  }

  /** Count of cells holding `material`. Used by tests to assert conservation. */
  count(material: MaterialId): number {
    let n = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === material) n++;
    }
    return n;
  }
}
