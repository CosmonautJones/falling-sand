import { Grid } from './grid';
import { Material } from './materials';

const WET = new Uint8Array(256);
WET[Material.Water] = WET[Material.Brine] = 255;

const LUSTER = new Uint8Array(256);
LUSTER[Material.Glass] = 190;
LUSTER[Material.Ice] = 130;
LUSTER[Material.Crystal] = 255;
LUSTER[Material.Gold] = 220;
LUSTER[Material.Mercury] = 180;
LUSTER[Material.Lead] = 80;
LUSTER[Material.Pearl] = 240;

const LIGHT = new Uint8Array(256);
LIGHT[Material.Fire] = LIGHT[Material.Lava] = LIGHT[Material.Ember] = 85;
LIGHT[Material.Aether] = 170;
LIGHT[Material.Azoth] = LIGHT[Material.Rift] = 255;

/** Read-only optical texture: heat shimmer, water, luster, emission family. */
export function blitOptics(grid: Grid, data: Uint8Array): void {
  for (let i = 0; i < grid.cells.length; i++) {
    const id = grid.cells[i];
    const o = i * 4;
    data[o] = Math.max(0, grid.heat[i] - 64);
    data[o + 1] = WET[id];
    data[o + 2] = LUSTER[id];
    data[o + 3] = LIGHT[id];
  }
}

/** Quarter-resolution visual glow; rebuilt each draw, with no persistent sim state. */
export class GlowMap {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  private readonly source: Float32Array;
  private readonly horizontal: Float32Array;

  constructor(private readonly grid: Grid) {
    this.width = Math.ceil(grid.width / 4);
    this.height = Math.ceil(grid.height / 4);
    this.data = new Uint8Array(this.width * this.height * 4);
    this.source = new Float32Array(this.data.length);
    this.horizontal = new Float32Array(this.data.length);
  }

  update(): void {
    const { grid, width, height, source, horizontal, data } = this;
    source.fill(0);
    for (let i = 0; i < grid.cells.length; i++) {
      const light = LIGHT[grid.cells[i]];
      if (light === 0) continue;
      const x = Math.floor((i % grid.width) / 4);
      const y = Math.floor(Math.floor(i / grid.width) / 4);
      const o = (y * width + x) * 4;
      // Max pooling retains isolated embers without brightening dense sources indefinitely.
      source[o] = Math.max(source[o], light === 85 ? 255 : light === 170 ? 40 : 158);
      source[o + 1] = Math.max(source[o + 1], light === 170 ? 122 : 72);
      source[o + 2] = Math.max(source[o + 2], light === 85 ? 12 : 217);
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let d = -2; d <= 2; d++) {
            if (x + d >= 0 && x + d < width) sum += source[o + d * 4 + c] * (3 - Math.abs(d));
          }
          horizontal[o + c] = sum / 9;
        }
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let d = -2; d <= 2; d++) {
            if (y + d >= 0 && y + d < height)
              sum += horizontal[o + d * width * 4 + c] * (3 - Math.abs(d));
          }
          data[o + c] = Math.round(sum / 9);
        }
        data[o + 3] = 255;
      }
    }
  }
}
