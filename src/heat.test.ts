import { beforeEach, describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material } from './materials';
import { blitGrid } from './render';
import { seedRng } from './rng';
import { resetSim, step } from './sim';

describe('heat', () => {
  beforeEach(() => {
    seedRng(1);
    resetSim();
  });

  it('lets an ember melt neighboring ice into water or steam', () => {
    const grid = new Grid(6, 5);
    for (let x = 0; x < 6; x++) grid.set(x, 4, Material.Stone);
    grid.set(2, 3, Material.Ice);
    grid.set(3, 3, Material.Ember);
    for (let i = 0; i < 10; i++) step(grid);
    expect(grid.count(Material.Ice)).toBe(0);
    expect(grid.count(Material.Water) + grid.count(Material.Steam)).toBeGreaterThan(0);
  });

  it('melts ice even when the ember is also touching water', () => {
    const grid = new Grid(7, 5);
    for (let x = 0; x < 7; x++) grid.set(x, 4, Material.Stone);
    grid.set(2, 3, Material.Ice);
    grid.set(3, 3, Material.Ember);
    grid.set(4, 3, Material.Water);
    for (let i = 0; i < 12; i++) step(grid);
    expect(grid.count(Material.Ice)).toBe(0);
  });

  it('moves heat with a grain on swap', () => {
    const grid = new Grid(4, 4);
    grid.set(1, 1, Material.Sand);
    grid.heat[grid.index(1, 1)] = 180;
    grid.swap(1, 1, 2, 2);
    expect(grid.getHeat(2, 2)).toBe(180);
    expect(grid.getHeat(1, 1)).toBeLessThan(40);
  });

  it('conducts heat through a stone wall until ice on the far side melts', () => {
    const grid = new Grid(5, 5);
    for (let x = 0; x < 5; x++) grid.set(x, 4, Material.Stone);
    grid.set(1, 3, Material.Lava);
    grid.set(2, 3, Material.Brick);
    grid.set(3, 3, Material.Ice);
    for (let i = 0; i < 120; i++) step(grid);
    expect(grid.get(3, 3)).not.toBe(Material.Ice);
  });

  it('lets hot water rise through a cooler column (buoyancy)', () => {
    const grid = new Grid(5, 8);
    for (let y = 0; y < 8; y++) {
      grid.set(1, y, Material.Stone);
      grid.set(3, y, Material.Stone);
    }
    for (let x = 0; x < 5; x++) grid.set(x, 7, Material.Stone);
    for (let y = 2; y <= 6; y++) grid.set(2, y, Material.Water);
    grid.heat[grid.index(2, 6)] = 200;
    step(grid);
    expect(grid.getHeat(2, 5)).toBeGreaterThan(grid.getHeat(2, 6));
    expect(grid.getHeat(2, 5)).toBeGreaterThan(50);
  });

  it('does not let a warm melt-pool snap back to ice in a couple of ticks', () => {
    const grid = new Grid(6, 5);
    for (let x = 0; x < 6; x++) grid.set(x, 4, Material.Stone);
    grid.set(1, 3, Material.Ice);
    grid.set(2, 3, Material.Water);
    grid.heat[grid.index(2, 3)] = 90;
    grid.set(3, 3, Material.Ember);
    step(grid);
    step(grid);
    expect(grid.count(Material.Water) + grid.count(Material.Steam)).toBeGreaterThan(0);
  });

  it('blits warmer sand redder than cold sand', () => {
    const grid = new Grid(4, 4);
    grid.set(1, 1, Material.Sand, 0);
    grid.set(2, 1, Material.Sand, 0);
    grid.heat[grid.index(1, 1)] = 18;
    grid.heat[grid.index(2, 1)] = 200;
    const data = new Uint8ClampedArray(4 * 4 * 4);
    blitGrid(grid, data, 0);
    const cold = (1 * 4 + 1) * 4;
    const hot = (1 * 4 + 2) * 4;
    expect(data[hot]).toBeGreaterThan(data[cold]);
  });
});
