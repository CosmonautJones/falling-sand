import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material } from './materials';
import { seedRng } from './rng';
import { createRite, rainFromCeiling } from './secrets';
import { seedVessel } from './world';

describe('rites', () => {
  it('preserves the full opening enclosure and every occupied sky cell during rain', () => {
    const grid = new Grid(480, 270);
    seedVessel(grid);
    grid.set(240, 1, Material.Brick);
    const before = grid.cells.slice();
    rainFromCeiling(grid, Material.Gold, 24);
    expect(grid.count(Material.Gold)).toBe(24);
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== Material.Air) expect(grid.cells[i]).toBe(before[i]);
    }
  });

  it('caps rain at available sky cells instead of replacing earlier grains', () => {
    const grid = new Grid(8, 4);
    for (let x = 0; x < 8; x++) grid.set(x, 1, Material.Brick);
    grid.set(3, 1, Material.Air);
    rainFromCeiling(grid, Material.Gold, 20);
    expect(grid.count(Material.Gold)).toBe(1);
    expect(grid.count(Material.Brick)).toBe(7);
    rainFromCeiling(grid, Material.Mercury, 20);
    expect(grid.count(Material.Gold)).toBe(1);
    expect(grid.count(Material.Mercury)).toBe(0);
  });

  it('opens aether rain after seven strikes on the name', () => {
    const rite = createRite();
    for (let i = 0; i < 6; i++) expect(rite.titleClick()).toBeNull();
    expect(rite.titleClick()).toBe('aether-rain');
    expect(rite.titleClick()).toBeNull();
  });

  it('opens gold rain on the konami rite', () => {
    const rite = createRite();
    const keys = [
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'b',
      'a',
    ];
    for (let i = 0; i < keys.length - 1; i++) expect(rite.key(keys[i])).toBeNull();
    expect(rite.key('a')).toBe('gold-rain');
  });

  it('opens void on the word nigredo and mercury on hermes', () => {
    const rite = createRite();
    expect(rite.key('n')).toBeNull();
    expect(rite.key('i')).toBeNull();
    expect(rite.key('g')).toBeNull();
    expect(rite.key('r')).toBeNull();
    expect(rite.key('e')).toBeNull();
    expect(rite.key('d')).toBeNull();
    expect(rite.key('o')).toBe('void-gift');
    for (const k of 'hermes') {
      const last = k === 's';
      expect(rite.key(k)).toBe(last ? 'mercury-gift' : null);
    }
  });

  it('rains a reagent from the ceiling without touching the floor', () => {
    seedRng(3);
    const grid = new Grid(24, 16);
    rainFromCeiling(grid, Material.Gold, 8);
    expect(grid.count(Material.Gold)).toBe(8);
    for (let x = 0; x < 24; x++) expect(grid.get(x, 15)).not.toBe(Material.Gold);
  });
});
