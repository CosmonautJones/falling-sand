import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material, MATERIALS } from './materials';
import { blitGrid } from './render';
import { seedRng } from './rng';
import { step } from './sim';

function uniqueRgb(grid: Grid, data: Uint8ClampedArray, material: number): Set<string> {
  const unique = new Set<string>();
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] !== material) continue;
    const o = i * 4;
    unique.add(`${data[o]},${data[o + 1]},${data[o + 2]}`);
  }
  return unique;
}

function nearBase(data: Uint8ClampedArray, offset: number, base: readonly [number, number, number], slack: number): void {
  expect(Math.abs(data[offset] - base[0])).toBeLessThanOrEqual(slack);
  expect(Math.abs(data[offset + 1] - base[1])).toBeLessThanOrEqual(slack);
  expect(Math.abs(data[offset + 2] - base[2])).toBeLessThanOrEqual(slack);
}

describe('grain colour', () => {
  it('paints a sand cluster with more than one RGB, each near the sand base colour', () => {
    seedRng(2024);
    const grid = new Grid(32, 32);
    grid.paint(16, 16, 6, Material.Sand);
    const data = new Uint8ClampedArray(32 * 32 * 4);
    blitGrid(grid, data);

    const base = MATERIALS[Material.Sand].color;
    let painted = 0;
    for (let i = 0; i < grid.cells.length; i++) {
      if (grid.cells[i] !== Material.Sand) continue;
      painted++;
      nearBase(data, i * 4, base, 40);
    }
    expect(painted).toBeGreaterThan(8);
    expect(uniqueRgb(grid, data, Material.Sand).size).toBeGreaterThan(1);
  });

  it('paints a water cluster with more than one RGB, each near the water base colour', () => {
    seedRng(2025);
    const grid = new Grid(32, 32);
    grid.paint(16, 16, 6, Material.Water);
    const data = new Uint8ClampedArray(32 * 32 * 4);
    blitGrid(grid, data);

    const base = MATERIALS[Material.Water].color;
    for (let i = 0; i < grid.cells.length; i++) {
      if (grid.cells[i] !== Material.Water) continue;
      nearBase(data, i * 4, base, 40);
    }
    expect(uniqueRgb(grid, data, Material.Water).size).toBeGreaterThan(1);
  });

  it('uses distinct base colours for fire, plant, and oil', () => {
    const used = [
      MATERIALS[Material.Sand].color,
      MATERIALS[Material.Water].color,
      MATERIALS[Material.Stone].color,
    ].map((c) => c.join(','));
    expect(used).not.toContain(MATERIALS[Material.Fire].color.join(','));
    expect(used).not.toContain(MATERIALS[Material.Plant].color.join(','));
    expect(used).not.toContain(MATERIALS[Material.Oil].color.join(','));
    expect(new Set([
      MATERIALS[Material.Fire].color.join(','),
      MATERIALS[Material.Plant].color.join(','),
      MATERIALS[Material.Oil].color.join(','),
    ]).size).toBe(3);
    const extra = [
      Material.Seed,
      Material.Ash,
      Material.Mud,
      Material.Glass,
      Material.Moss,
      Material.Ice,
      Material.Wood,
      Material.Salt,
      Material.Steam,
      Material.Lava,
      Material.Ember,
      Material.Obsidian,
      Material.Brine,
      Material.Crystal,
      Material.Acid,
      Material.Lead,
      Material.Mercury,
      Material.Gold,
      Material.Aether,
      Material.Azoth,
      Material.Void,
      Material.Powder,
      Material.Brick,
      Material.Rift,
      Material.Tnt,
      Material.Nitro,
    ].map((id) => MATERIALS[id].color.join(','));
    expect(new Set(extra).size).toBe(extra.length);
    for (const c of extra) expect(used).not.toContain(c);
  });

  it('clears every cell to air', () => {
    const grid = new Grid(8, 8);
    grid.paint(4, 4, 3, Material.Sand);
    grid.paint(2, 2, 2, Material.Oil);
    grid.clear();
    expect(grid.count(Material.Air)).toBe(64);
    expect(grid.getShade(4, 4)).toBe(0);
  });

  it('paints strictly more cells with a larger radius', () => {
    const small = new Grid(24, 24);
    const large = new Grid(24, 24);
    small.paint(12, 12, 1, Material.Plant);
    large.paint(12, 12, 3, Material.Plant);
    expect(large.count(Material.Plant)).toBeGreaterThan(small.count(Material.Plant));
  });

  it('keeps a grain’s variant RGB when the grain moves', () => {
    seedRng(7);
    const grid = new Grid(4, 8);
    grid.paint(2, 0, 0, Material.Sand);

    const before = new Uint8ClampedArray(4 * 8 * 4);
    blitGrid(grid, before);
    const src = grid.index(2, 0) * 4;
    const rgb = [before[src], before[src + 1], before[src + 2]];
    expect(rgb).not.toEqual([...MATERIALS[Material.Air].color]);

    step(grid);

    const after = new Uint8ClampedArray(4 * 8 * 4);
    blitGrid(grid, after);
    const dest = grid.index(2, 1) * 4;
    expect([after[dest], after[dest + 1], after[dest + 2]]).toEqual(rgb);
    expect([after[src], after[src + 1], after[src + 2]]).toEqual([...MATERIALS[Material.Air].color]);
  });

  it('darkens settled sand against neighbors while a lone grain stays undimmed', () => {
    seedRng(3);
    const lone = new Grid(8, 8);
    lone.set(2, 2, Material.Sand, 0);
    const pile = new Grid(8, 8);
    pile.paint(4, 4, 2, Material.Sand);
    const a = new Uint8ClampedArray(8 * 8 * 4);
    const b = new Uint8ClampedArray(8 * 8 * 4);
    blitGrid(lone, a);
    blitGrid(pile, b);
    const lo = lone.index(2, 2) * 4;
    const loneLum = a[lo] + a[lo + 1] + a[lo + 2];
    let darker = 0;
    for (let i = 0; i < pile.cells.length; i++) {
      if (pile.cells[i] !== Material.Sand) continue;
      const o = i * 4;
      if (b[o] + b[o + 1] + b[o + 2] < loneLum) darker++;
    }
    expect(darker).toBeGreaterThan(0);
  });

  it('flickers fire across ticks without leaving the fire hue', () => {
    const grid = new Grid(4, 4);
    grid.set(1, 1, Material.Fire, 0);
    const a = new Uint8ClampedArray(4 * 4 * 4);
    const b = new Uint8ClampedArray(4 * 4 * 4);
    blitGrid(grid, a, 0);
    blitGrid(grid, b, 11);
    const o = grid.index(1, 1) * 4;
    expect([b[o], b[o + 1], b[o + 2]]).not.toEqual([a[o], a[o + 1], a[o + 2]]);
    nearBase(b, o, MATERIALS[Material.Fire].color, 48);
  });

  it('sparkles gold across ticks without leaving the gold hue', () => {
    const grid = new Grid(4, 4);
    grid.set(1, 1, Material.Gold, 0);
    const a = new Uint8ClampedArray(4 * 4 * 4);
    const b = new Uint8ClampedArray(4 * 4 * 4);
    blitGrid(grid, a, 0);
    blitGrid(grid, b, 13);
    const o = grid.index(1, 1) * 4;
    expect([b[o], b[o + 1], b[o + 2]]).not.toEqual([a[o], a[o + 1], a[o + 2]]);
    nearBase(b, o, MATERIALS[Material.Gold].color, 64);
  });

  it('flickers lava across ticks without leaving the lava hue', () => {
    const grid = new Grid(4, 4);
    grid.set(1, 1, Material.Lava, 0);
    const a = new Uint8ClampedArray(4 * 4 * 4);
    const b = new Uint8ClampedArray(4 * 4 * 4);
    blitGrid(grid, a, 0);
    blitGrid(grid, b, 11);
    const o = grid.index(1, 1) * 4;
    expect([b[o], b[o + 1], b[o + 2]]).not.toEqual([a[o], a[o + 1], a[o + 2]]);
    nearBase(b, o, MATERIALS[Material.Lava].color, 56);
  });

  it('keeps an oil grain’s variant RGB when it falls', () => {
    seedRng(11);
    const grid = new Grid(4, 8);
    grid.paint(2, 0, 0, Material.Oil);
    const before = new Uint8ClampedArray(4 * 8 * 4);
    blitGrid(grid, before);
    const src = grid.index(2, 0) * 4;
    const rgb = [before[src], before[src + 1], before[src + 2]];
    step(grid);
    const after = new Uint8ClampedArray(4 * 8 * 4);
    blitGrid(grid, after);
    const dest = grid.index(2, 1) * 4;
    expect([after[dest], after[dest + 1], after[dest + 2]]).toEqual(rgb);
  });
});
