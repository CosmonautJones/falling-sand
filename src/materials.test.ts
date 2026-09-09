import { describe, expect, it } from 'vitest';
import {
  isMaterialId,
  Material,
  MATERIALS,
  SHADE_RANGE,
  STARTER,
  TRANSMUTED,
} from './materials';

describe('materials', () => {
  it('gives every reagent a unique name, colour, and shade range', () => {
    const ids = Object.values(Material);
    expect(ids.length).toBeGreaterThanOrEqual(20);
    expect(new Set(ids.map((id) => MATERIALS[id].name)).size).toBe(ids.length);
    expect(new Set(ids.map((id) => MATERIALS[id].color.join(','))).size).toBe(ids.length);
    for (const id of ids) {
      expect(SHADE_RANGE[id]).toBeGreaterThanOrEqual(0);
      expect(isMaterialId(id)).toBe(true);
    }
    expect(isMaterialId(255)).toBe(false);
  });

  it('starts with ice, wood, salt, and lava on the bench, and hides steam-born reagents', () => {
    expect(STARTER).toEqual(expect.arrayContaining([
      Material.Ice,
      Material.Wood,
      Material.Salt,
      Material.Lava,
      Material.Acid,
      Material.Lead,
      Material.Tnt,
    ]));
    expect(TRANSMUTED).toEqual(expect.arrayContaining([
      Material.Steam,
      Material.Ember,
      Material.Obsidian,
      Material.Brine,
      Material.Crystal,
      Material.Mercury,
      Material.Gold,
      Material.Aether,
      Material.Azoth,
      Material.Void,
      Material.Powder,
      Material.Brick,
      Material.Rift,
      Material.Nitro,
    ]));
    for (const id of TRANSMUTED) expect(STARTER).not.toContain(id);
  });

  it('treats steam as gas, lava and brine as liquid, salt as powder', () => {
    expect(MATERIALS[Material.Steam].kind).toBe('gas');
    expect(MATERIALS[Material.Lava].kind).toBe('liquid');
    expect(MATERIALS[Material.Brine].kind).toBe('liquid');
    expect(MATERIALS[Material.Salt].kind).toBe('powder');
    expect(MATERIALS[Material.Ember].kind).toBe('powder');
    expect(MATERIALS[Material.Ice].kind).toBe('static');
    expect(MATERIALS[Material.Wood].kind).toBe('static');
    expect(MATERIALS[Material.Water].kind).toBe('liquid');
    expect(MATERIALS[Material.Sand].kind).toBe('powder');
    expect(MATERIALS[Material.Oil].density).toBeLessThan(MATERIALS[Material.Water].density);
    expect(MATERIALS[Material.Steam].density).toBeLessThan(MATERIALS[Material.Air].density);
    expect(MATERIALS[Material.Lava].density).toBeGreaterThan(MATERIALS[Material.Water].density);
    expect(MATERIALS[Material.Brine].density).toBeGreaterThan(MATERIALS[Material.Water].density);
    expect(MATERIALS[Material.Acid].kind).toBe('liquid');
    expect(MATERIALS[Material.Mercury].kind).toBe('liquid');
    expect(MATERIALS[Material.Gold].kind).toBe('powder');
    expect(MATERIALS[Material.Aether].kind).toBe('gas');
    expect(MATERIALS[Material.Azoth].kind).toBe('static');
    expect(MATERIALS[Material.Void].kind).toBe('powder');
    expect(MATERIALS[Material.Aether].density).toBeLessThan(MATERIALS[Material.Steam].density);
    expect(MATERIALS[Material.Gold].density).toBeGreaterThan(MATERIALS[Material.Lead].density);
    expect(MATERIALS[Material.Brick].kind).toBe('static');
    expect(MATERIALS[Material.Rift].kind).toBe('static');
    expect(MATERIALS[Material.Tnt].kind).toBe('static');
    expect(MATERIALS[Material.Nitro].kind).toBe('liquid');
  });
});
