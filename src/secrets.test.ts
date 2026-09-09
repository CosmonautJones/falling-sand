import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material } from './materials';
import { seedRng } from './rng';
import { createRite, rainFromCeiling } from './secrets';

describe('rites', () => {
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
