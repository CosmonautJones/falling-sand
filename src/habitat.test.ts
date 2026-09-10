import { beforeEach, describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material, type MaterialId } from './materials';
import { seedRng } from './rng';
import { resetSim, step } from './sim';

// Glass holds moisture and loose substrate in place without feeding fire or moss.
function bed(grid: Grid, x: number, y: number, life: MaterialId): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) grid.set(x + dx, y + dy, Material.Glass);
  }
  grid.set(x, y, life);
  grid.set(x - 1, y, life === Material.Plant ? Material.Ash : Material.Water);
  grid.set(x + 1, y, Material.Sand);
}

describe('habitat reliability', () => {
  beforeEach(() => {
    seedRng(7);
    resetSim();
  });

  it.each([Material.Plant, Material.Wood])(
    'resolves diagonal ignition of fuel %i instead of burning forever below catch heat',
    (fuel) => {
      const grid = new Grid(480, 270);
      grid.set(240, 130, Material.Fire);
      grid.set(241, 131, fuel);
      step(grid);
      expect(grid.get(241, 131)).toBe(fuel);
      for (let tick = 1; tick < 180; tick++) step(grid);
      expect(grid.count(fuel)).toBe(0);
      expect(grid.count(Material.Fire) + grid.count(Material.Ember)).toBe(0);
    },
    15_000,
  );

  it('keeps fired walls standing beside mature wet moss in the full vessel', () => {
    const grid = new Grid(480, 270);
    bed(grid, 240, 250, Material.Moss);
    grid.set(241, 250, Material.Brick);
    for (let y = 246; y <= 253; y++) grid.set(242, y, Material.Brick);
    for (let tick = 0; tick < 1860; tick++) step(grid);
    for (let y = 246; y <= 253; y++) expect(grid.get(242, y)).toBe(Material.Brick);
    expect(grid.get(241, 250)).toBe(Material.Brick);
    expect(grid.count(Material.Brick)).toBe(9);
  }, 40_000);

  it('requires a minute of local nourishment, even for a new garden in an old vessel', () => {
    const grid = new Grid(14, 8);
    for (let tick = 0; tick < 6000; tick++) step(grid);
    bed(grid, 4, 4, Material.Plant);
    for (let tick = 0; tick < 3599; tick++) step(grid);
    expect(grid.get(5, 4)).toBe(Material.Sand);
    step(grid);
    expect(grid.get(5, 4)).toBe(Material.Plant);
  });

  it('requires uninterrupted local moisture for moss and restarts after drying', () => {
    const grid = new Grid(14, 8);
    bed(grid, 4, 4, Material.Moss);
    for (let tick = 0; tick < 1790; tick++) step(grid);
    expect(grid.get(5, 4)).toBe(Material.Sand);
    grid.set(3, 4, Material.Glass);
    step(grid);
    grid.set(3, 4, Material.Water);
    for (let tick = 0; tick < 1799; tick++) step(grid);
    expect(grid.get(5, 4)).toBe(Material.Sand);
    for (let tick = 0; tick < 60; tick++) step(grid);
    expect(grid.get(5, 4)).toBe(Material.Moss);
  });
});
