import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material } from './materials';
import { step } from './sim';

describe('baseline step', () => {
  it('moves a suspended sand grain down one cell per step', () => {
    const grid = new Grid(4, 8);
    grid.set(2, 0, Material.Sand);
    step(grid);
    expect(grid.get(2, 0)).toBe(Material.Air);
    expect(grid.get(2, 1)).toBe(Material.Sand);
  });

  it('conserves sand while falling', () => {
    const grid = new Grid(8, 8);
    grid.paint(4, 1, 2, Material.Sand);
    const before = grid.count(Material.Sand);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.count(Material.Sand)).toBe(before);
  });

  it('rests sand on the floor', () => {
    const grid = new Grid(4, 4);
    grid.set(1, 0, Material.Sand);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.get(1, 3)).toBe(Material.Sand);
  });

  it('stacks sand on top of stone', () => {
    const grid = new Grid(4, 6);
    grid.set(1, 4, Material.Stone);
    grid.set(1, 0, Material.Sand);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.get(1, 3)).toBe(Material.Sand);
    expect(grid.get(1, 4)).toBe(Material.Stone);
  });

  // The following document what the baseline deliberately does NOT do.
  // They are the behaviours the real engine has to introduce.

  it('does not move water at all (no liquid model yet)', () => {
    const grid = new Grid(4, 8);
    grid.set(2, 0, Material.Water);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.get(2, 0)).toBe(Material.Water);
  });

  it('does not let sand sink through water (no density exchange yet)', () => {
    const grid = new Grid(4, 4);
    grid.set(1, 1, Material.Sand);
    grid.set(1, 2, Material.Water);
    step(grid);
    expect(grid.get(1, 1)).toBe(Material.Sand);
    expect(grid.get(1, 2)).toBe(Material.Water);
  });

  it('piles sand into a flat-topped column instead of a slope (no angle of repose yet)', () => {
    const grid = new Grid(9, 9);
    for (let i = 0; i < 5; i++) grid.set(4, i, Material.Sand);
    for (let i = 0; i < 32; i++) step(grid);
    expect(grid.get(4, 8)).toBe(Material.Sand);
    expect(grid.get(4, 4)).toBe(Material.Sand);
    expect(grid.get(3, 8)).toBe(Material.Air);
    expect(grid.get(5, 8)).toBe(Material.Air);
  });
});
