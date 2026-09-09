import { describe, expect, it } from 'vitest';
import { Material, MATERIALS, STARTER, TRANSMUTED } from './materials';
import { blanks, page, stained, whisper } from './codex';

describe('codex', () => {
  it('gives every reagent a whisper and a leaf', () => {
    for (const id of Object.values(Material)) {
      const leaf = page(id);
      expect(leaf.whisper.length).toBeGreaterThan(8);
      expect(leaf.leaf.length).toBeGreaterThan(16);
      expect(whisper(id)).toBe(leaf.whisper);
    }
  });

  it('stains only the pages that have been seen, in bench order', () => {
    const known = new Set([Material.Sand, Material.Steam, Material.Gold]);
    const pages = stained(known);
    expect(pages.map((p) => p.id)).toEqual([Material.Sand, Material.Steam, Material.Gold]);
    expect(pages[1]?.whisper).toBe('Water climbs as a ghost.');
  });

  it('counts blank pages as the reagents not yet seen', () => {
    const known = new Set(STARTER);
    const total = Object.values(Material).length;
    expect(blanks(known)).toBe(total - STARTER.length);
    expect(blanks(new Set([...STARTER, ...TRANSMUTED]))).toBe(0);
  });

  it('keeps the Magnum Opus line for azoth', () => {
    expect(page(Material.Azoth).whisper).toMatch(/Solve et coagula/);
    expect(MATERIALS[Material.Azoth].name).toBe('azoth');
  });
});
