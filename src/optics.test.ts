import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material } from './materials';
import { blitOptics, GlowMap } from './optics';

describe('vessel optics', () => {
  it('spreads a small light locally, preserves its colour and clears erased light', () => {
    const grid = new Grid(80, 40);
    grid.set(40, 20, Material.Fire);
    const glow = new GlowMap(grid);
    glow.update();
    const nearby = (5 * glow.width + 11) * 4;
    expect(glow.data[nearby]).toBeGreaterThan(0);
    expect(glow.data[nearby]).toBeGreaterThan(glow.data[nearby + 1]);
    expect(glow.data[0]).toBe(0);
    grid.clear();
    glow.update();
    expect(glow.data.every((value, i) => i % 4 === 3 || value === 0)).toBe(true);
  });

  it('keeps warm-colored sand and blue creatures from posing as fire or water', () => {
    const grid = new Grid(4, 1);
    grid.set(0, 0, Material.Sand, 20);
    grid.set(1, 0, Material.Minnow);
    grid.set(2, 0, Material.Water);
    grid.set(3, 0, Material.Fire);
    const data = new Uint8Array(16);
    blitOptics(grid, data);
    expect(Array.from(data.slice(0, 8))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(data[9]).toBe(255);
    expect(data[11]).toBe(0);
    expect(data[12]).toBeGreaterThan(0);
    expect(data[15]).toBeGreaterThan(0);
  });

  it('moves heat shimmer with the hot grain and removes it when erased', () => {
    const grid = new Grid(2, 1);
    grid.set(0, 0, Material.Sand);
    grid.heat[0] = 200;
    const data = new Uint8Array(8);
    blitOptics(grid, data);
    expect(data[0]).toBeGreaterThan(0);
    expect(data[3]).toBe(0); // Hot sand can shimmer without becoming a light source.
    grid.swap(0, 0, 1, 0);
    blitOptics(grid, data);
    expect(data[0]).toBe(0);
    expect(data[4]).toBeGreaterThan(0);
    grid.clear();
    blitOptics(grid, data);
    expect(data.every((value) => value === 0)).toBe(true);
  });

  it('gives glass and gold highlights without making them emit light', () => {
    const grid = new Grid(3, 1);
    grid.set(0, 0, Material.Glass);
    grid.set(1, 0, Material.Gold);
    grid.set(2, 0, Material.Aether);
    const data = new Uint8Array(12);
    blitOptics(grid, data);
    expect(data[2]).toBeGreaterThan(0);
    expect(data[6]).toBeGreaterThan(0);
    expect(data[3] + data[7]).toBe(0);
    expect(data[11]).toBeGreaterThan(0);
  });

  it('leaves all simulation state untouched during repeated presentation', () => {
    const grid = new Grid(8, 8);
    grid.set(3, 3, Material.Mite, -45);
    grid.set(4, 3, Material.Lava);
    grid.trails[27] = 90;
    grid.growth[27] = 1200;
    const before = [
      grid.cells.slice(),
      grid.shades.slice(),
      grid.heat.slice(),
      grid.trails.slice(),
      grid.growth.slice(),
    ];
    const data = new Uint8Array(8 * 8 * 4);
    for (let tick = 0; tick < 120; tick++) blitOptics(grid, data);
    expect([grid.cells, grid.shades, grid.heat, grid.trails, grid.growth]).toEqual(before);
  });
});
