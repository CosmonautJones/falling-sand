import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material } from './materials';

describe('Grid', () => {
  it('rejects non-positive or non-integer dimensions', () => {
    expect(() => new Grid(0, 10)).toThrow(RangeError);
    expect(() => new Grid(10, -1)).toThrow(RangeError);
    expect(() => new Grid(10.5, 10)).toThrow(RangeError);
  });

  it('starts filled with air', () => {
    const grid = new Grid(8, 4);
    expect(grid.count(Material.Air)).toBe(32);
  });

  it('round-trips a set through a get', () => {
    const grid = new Grid(8, 4);
    grid.set(3, 2, Material.Sand);
    expect(grid.get(3, 2)).toBe(Material.Sand);
  });

  it('reads out of bounds as stone so the world is an enclosed box', () => {
    const grid = new Grid(4, 4);
    expect(grid.get(-1, 0)).toBe(Material.Stone);
    expect(grid.get(0, -1)).toBe(Material.Stone);
    expect(grid.get(4, 0)).toBe(Material.Stone);
    expect(grid.get(0, 4)).toBe(Material.Stone);
  });

  it('ignores writes out of bounds', () => {
    const grid = new Grid(4, 4);
    grid.set(-1, 0, Material.Sand);
    grid.set(4, 4, Material.Sand);
    expect(grid.count(Material.Sand)).toBe(0);
  });

  it('swaps two cells', () => {
    const grid = new Grid(4, 4);
    grid.set(1, 1, Material.Sand);
    grid.swap(1, 1, 2, 2);
    expect(grid.get(1, 1)).toBe(Material.Air);
    expect(grid.get(2, 2)).toBe(Material.Sand);
  });

  it('swap moves shade with the material', () => {
    const grid = new Grid(4, 4);
    grid.set(1, 1, Material.Sand, 9);
    grid.swap(1, 1, 2, 2);
    expect(grid.get(1, 1)).toBe(Material.Air);
    expect(grid.getShade(1, 1)).toBe(0);
    expect(grid.get(2, 2)).toBe(Material.Sand);
    expect(grid.getShade(2, 2)).toBe(9);
  });

  it('leaves the grid untouched when a swap target is out of bounds', () => {
    const grid = new Grid(4, 4);
    grid.set(0, 0, Material.Sand);
    grid.swap(0, 0, -1, 0);
    expect(grid.get(0, 0)).toBe(Material.Sand);
  });

  it('paints a filled disc clipped to bounds', () => {
    const grid = new Grid(16, 16);
    grid.paint(8, 8, 2, Material.Water);
    expect(grid.get(8, 8)).toBe(Material.Water);
    expect(grid.get(8, 6)).toBe(Material.Water);
    expect(grid.get(6, 6)).toBe(Material.Air);
    expect(grid.count(Material.Water)).toBe(13);
  });

  it('paints a line of grains between two cells so a fast stroke cannot skip', () => {
    const grid = new Grid(24, 8);
    grid.paintLine(1, 3, 20, 3, 0, Material.Sand);
    expect(grid.count(Material.Sand)).toBe(20);
    for (let x = 1; x <= 20; x++) expect(grid.get(x, 3)).toBe(Material.Sand);
  });

  it('paints a diagonal line through every crossed cell', () => {
    const grid = new Grid(12, 12);
    grid.paintLine(0, 0, 5, 5, 0, Material.Stone);
    expect(grid.count(Material.Stone)).toBe(6);
    expect(grid.get(0, 0)).toBe(Material.Stone);
    expect(grid.get(5, 5)).toBe(Material.Stone);
    expect(grid.get(3, 3)).toBe(Material.Stone);
  });


  it('clears back to air', () => {
    const grid = new Grid(4, 4);
    grid.paint(2, 2, 2, Material.Stone);
    grid.set(0, 0, Material.Sand, 7);
    grid.clear();
    expect(grid.count(Material.Air)).toBe(16);
    expect(grid.getShade(0, 0)).toBe(0);
  });
});
