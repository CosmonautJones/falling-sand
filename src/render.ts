import { Grid } from './grid';
import { MATERIALS, type MaterialId } from './materials';

/** Blits the grid to a canvas one pixel per cell via a reused ImageData buffer. */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly grid: Grid;

  constructor(canvas: HTMLCanvasElement, grid: Grid) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    canvas.width = grid.width;
    canvas.height = grid.height;
    this.ctx = ctx;
    this.grid = grid;
    this.image = ctx.createImageData(grid.width, grid.height);
  }

  draw(): void {
    const data = this.image.data;
    const cells = this.grid.cells;
    for (let i = 0; i < cells.length; i++) {
      const color = MATERIALS[cells[i] as MaterialId].color;
      const o = i * 4;
      data[o] = color[0];
      data[o + 1] = color[1];
      data[o + 2] = color[2];
      data[o + 3] = 255;
    }
    this.ctx.putImageData(this.image, 0, 0);
  }
}
