import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material } from './materials';
import { HEIGHT, WIDTH, seedVessel } from './world';

describe('vessel', () => {
  it('is a wide playfield, not a postage stamp', () => {
    expect(WIDTH).toBeGreaterThanOrEqual(420);
    expect(HEIGHT).toBeGreaterThanOrEqual(240);
    expect(WIDTH * HEIGHT).toBeGreaterThan(100_000);
  });

  it('charges the vessel with a scene instead of empty air', () => {
    const grid = new Grid(WIDTH, HEIGHT);
    seedVessel(grid);
    expect(grid.count(Material.Air)).toBeLessThan(WIDTH * HEIGHT);
    expect(grid.count(Material.Stone)).toBeGreaterThan(80);
    expect(grid.count(Material.Sand)).toBeGreaterThan(20);
    expect(grid.count(Material.Water)).toBeGreaterThan(10);
    expect(grid.count(Material.Ice)).toBeGreaterThan(4);
    expect(grid.count(Material.Wood)).toBeGreaterThan(4);
    expect(grid.count(Material.Lava)).toBeGreaterThan(4);
    expect(grid.count(Material.Salt)).toBeGreaterThan(4);
    expect(grid.count(Material.Seed)).toBeGreaterThan(0);
  });
});
