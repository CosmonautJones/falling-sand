import { beforeEach, describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material, MATERIALS, STARTER, TRANSMUTED } from './materials';
import { blitGrid } from './render';
import { seedRng } from './rng';
import { resetSim, step } from './sim';
import { HEIGHT, WIDTH, seedVessel } from './world';

function positions(grid: Grid, material: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.get(x, y) === material) out.push({ x, y });
    }
  }
  return out;
}

function stoneFloor(grid: Grid, y: number): void {
  for (let x = 0; x < grid.width; x++) grid.set(x, y, Material.Stone);
}

describe('life', () => {
  beforeEach(() => {
    seedRng(1);
    resetSim();
  });

  it('keeps mite, minnow, bloom, and pearl off the starting bench', () => {
    for (const id of [Material.Mite, Material.Minnow, Material.Bloom, Material.Pearl]) {
      expect(STARTER).not.toContain(id);
      expect(TRANSMUTED).toContain(id);
    }
    expect(MATERIALS[Material.Mite].kind).toBe('powder');
    expect(MATERIALS[Material.Minnow].kind).toBe('powder');
    expect(MATERIALS[Material.Bloom].kind).toBe('static');
    expect(MATERIALS[Material.Pearl].kind).toBe('static');
  });

  it('paints mites the colour of sand so a dune can hide them', () => {
    const sand = MATERIALS[Material.Sand].color;
    const mite = MATERIALS[Material.Mite].color;
    const dist = Math.hypot(sand[0] - mite[0], sand[1] - mite[1], sand[2] - mite[2]);
    expect(dist).toBeLessThan(45);
    expect(mite.join(',')).not.toBe(sand.join(','));
  });

  it('lets a suspended mite fall like powder', () => {
    const grid = new Grid(4, 8);
    grid.set(2, 0, Material.Mite);
    step(grid);
    expect(grid.get(2, 0)).toBe(Material.Air);
    expect(grid.get(2, 1)).toBe(Material.Mite);
  });

  it('lets a mite crawl along a floor instead of sitting still', () => {
    const grid = new Grid(10, 5);
    stoneFloor(grid, 4);
    grid.set(4, 3, Material.Mite);
    let travelled = false;
    for (let i = 0; i < 48; i++) {
      step(grid);
      const [mite] = positions(grid, Material.Mite);
      if (mite && mite.x !== 4) travelled = true;
    }
    expect(grid.count(Material.Mite)).toBe(1);
    const [mite] = positions(grid, Material.Mite);
    expect(mite.y).toBe(3);
    expect(travelled).toBe(true);
  });

  it('lets a mite burrow through sand without losing sand grains', () => {
    const grid = new Grid(7, 7);
    for (let y = 2; y <= 5; y++) {
      for (let x = 1; x <= 5; x++) grid.set(x, y, Material.Sand);
    }
    grid.set(3, 3, Material.Mite);
    const sand = grid.count(Material.Sand);
    let travelled = false;
    for (let i = 0; i < 48; i++) {
      step(grid);
      const [mite] = positions(grid, Material.Mite);
      if (mite && (mite.x !== 3 || mite.y !== 3)) travelled = true;
    }
    expect(grid.count(Material.Mite)).toBe(1);
    expect(grid.count(Material.Sand)).toBe(sand);
    expect(travelled).toBe(true);
  });

  it('lets a mite eat a neighboring plant', () => {
    const grid = new Grid(6, 5);
    stoneFloor(grid, 4);
    grid.set(2, 3, Material.Mite);
    grid.set(3, 3, Material.Plant);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Plant)).toBe(0);
    expect(grid.count(Material.Mite)).toBe(1);
  });

  it('sends a mite away from neighboring fire', () => {
    const grid = new Grid(8, 5);
    stoneFloor(grid, 4);
    grid.set(3, 3, Material.Mite);
    grid.set(4, 3, Material.Fire);
    for (let i = 0; i < 6; i++) step(grid);
    const mites = positions(grid, Material.Mite);
    if (mites.length === 1) {
      expect(mites[0].x).toBeLessThan(3);
    } else {
      expect(grid.count(Material.Ash)).toBeGreaterThan(0);
    }
  });

  it('lets a mite pick up neighboring gold and walk off with it', () => {
    const grid = new Grid(7, 5);
    stoneFloor(grid, 4);
    grid.set(2, 3, Material.Mite);
    grid.set(3, 3, Material.Gold);
    step(grid);
    expect(grid.count(Material.Gold)).toBe(0);
    expect(grid.count(Material.Mite)).toBe(1);
    const [mite] = positions(grid, Material.Mite);
    expect(grid.getShade(mite.x, mite.y)).toBeGreaterThanOrEqual(64);
  });

  it('lets a gold-laden mite drop its hoard next to other gold', () => {
    const grid = new Grid(7, 5);
    stoneFloor(grid, 4);
    grid.set(2, 3, Material.Mite, 90);
    grid.set(3, 3, Material.Gold);
    step(grid);
    expect(grid.count(Material.Gold)).toBeGreaterThanOrEqual(2);
    expect(grid.count(Material.Mite)).toBe(1);
  });

  it('hatches a mite from mud that sits against plant', () => {
    const grid = new Grid(6, 5);
    stoneFloor(grid, 4);
    grid.set(2, 3, Material.Mud);
    grid.set(3, 3, Material.Plant);
    grid.set(2, 2, Material.Water);
    for (let i = 0; i < 80; i++) step(grid);
    expect(grid.count(Material.Mite)).toBeGreaterThan(0);
  });

  it('lets a minnow swim through a pool without leaving the water', () => {
    const grid = new Grid(10, 6);
    stoneFloor(grid, 5);
    for (let x = 1; x <= 8; x++) grid.set(x, 4, Material.Water);
    grid.set(2, 4, Material.Minnow);
    let travelled = false;
    for (let i = 0; i < 24; i++) {
      step(grid);
      const [fish] = positions(grid, Material.Minnow);
      if (fish && fish.x !== 2) travelled = true;
    }
    expect(grid.count(Material.Minnow)).toBe(1);
    const [fish] = positions(grid, Material.Minnow);
    expect(fish.y).toBe(4);
    expect(travelled).toBe(true);
    expect(grid.count(Material.Water)).toBe(7);
  });

  it('schools two minnows toward each other in a trough', () => {
    const grid = new Grid(9, 5);
    stoneFloor(grid, 4);
    for (let x = 1; x <= 7; x++) grid.set(x, 3, Material.Water);
    grid.set(1, 3, Material.Minnow);
    grid.set(7, 3, Material.Minnow);
    for (let i = 0; i < 20; i++) step(grid);
    const fish = positions(grid, Material.Minnow);
    expect(fish).toHaveLength(2);
    expect(Math.abs(fish[0].x - fish[1].x)).toBeLessThanOrEqual(3);
    expect(fish.every((p) => p.y === 3)).toBe(true);
  });

  it('lets a minnow eat a mite that touches the pool', () => {
    const grid = new Grid(6, 5);
    stoneFloor(grid, 4);
    grid.set(1, 3, Material.Water);
    grid.set(2, 3, Material.Water);
    grid.set(1, 3, Material.Minnow);
    grid.set(2, 3, Material.Mite);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Mite)).toBe(0);
    expect(grid.count(Material.Minnow)).toBe(1);
  });

  it('cooks a minnow that touches oil into ash', () => {
    const grid = new Grid(6, 5);
    stoneFloor(grid, 4);
    grid.set(2, 3, Material.Minnow);
    grid.set(3, 3, Material.Oil);
    for (let i = 0; i < 6; i++) step(grid);
    expect(grid.count(Material.Minnow)).toBe(0);
    expect(grid.count(Material.Ash)).toBeGreaterThan(0);
  });

  it('lets a wet plant thicket open a bloom', () => {
    const grid = new Grid(6, 6);
    for (let y = 2; y <= 4; y++) {
      for (let x = 2; x <= 4; x++) grid.set(x, y, Material.Plant);
    }
    grid.set(3, 1, Material.Water);
    for (let i = 0; i < 80; i++) step(grid);
    expect(grid.count(Material.Bloom)).toBeGreaterThan(0);
  });

  it('burns bloom the way it burns plant', () => {
    const grid = new Grid(5, 5);
    grid.set(2, 2, Material.Bloom);
    grid.set(2, 1, Material.Fire);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.count(Material.Bloom)).toBe(0);
  });

  it('condenses a steam cloud at the ceiling into dew, and leaves a lone wisp', () => {
    const lone = new Grid(4, 6);
    lone.set(2, 5, Material.Steam);
    for (let i = 0; i < 16; i++) step(lone);
    expect(lone.count(Material.Steam)).toBe(1);
    expect(positions(lone, Material.Steam)[0].y).toBe(0);

    const cloud = new Grid(5, 6);
    cloud.set(1, 5, Material.Steam);
    cloud.set(2, 5, Material.Steam);
    for (let i = 0; i < 24; i++) step(cloud);
    expect(cloud.count(Material.Water)).toBeGreaterThan(0);
  });

  it('lets a minnow beside crystal leave a pearl', () => {
    seedRng(7);
    const grid = new Grid(6, 5);
    stoneFloor(grid, 4);
    for (let x = 1; x <= 4; x++) grid.set(x, 3, Material.Water);
    grid.set(2, 3, Material.Minnow);
    grid.set(3, 2, Material.Crystal);
    for (let i = 0; i < 80; i++) step(grid);
    expect(grid.count(Material.Pearl)).toBeGreaterThan(0);
  });

  it('tints a gold-laden mite toward the gold it stole', () => {
    const grid = new Grid(4, 4);
    grid.set(1, 2, Material.Mite, 90);
    const data = new Uint8ClampedArray(4 * 4 * 4);
    blitGrid(grid, data, 0);
    const o = (2 * 4 + 1) * 4;
    const [mr, mg] = MATERIALS[Material.Mite].color;
    expect(data[o]).toBeGreaterThan(mr);
    expect(data[o + 1]).toBeGreaterThanOrEqual(mg);
  });

  it('charges the opening vessel with mites in the dune and a minnow in the trough', () => {
    const grid = new Grid(WIDTH, HEIGHT);
    seedVessel(grid);
    expect(grid.count(Material.Mite)).toBeGreaterThanOrEqual(3);
    expect(grid.count(Material.Minnow)).toBeGreaterThanOrEqual(2);
    expect(grid.count(Material.Plant)).toBeGreaterThanOrEqual(2);
  });

  it('spills stolen gold when a laden mite dies of heat', () => {
    const grid = new Grid(5, 5);
    for (let y = 2; y <= 4; y++) {
      for (let x = 1; x <= 3; x++) grid.set(x, y, Material.Stone);
    }
    grid.set(2, 3, Material.Mite, 90);
    grid.set(2, 2, Material.Fire);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Gold)).toBeGreaterThanOrEqual(1);
    expect(grid.count(Material.Mite)).toBe(0);
  });

  it('leaves gold behind when a minnow eats a laden mite', () => {
    const grid = new Grid(6, 5);
    stoneFloor(grid, 4);
    grid.set(1, 3, Material.Water);
    grid.set(2, 3, Material.Water);
    grid.set(1, 3, Material.Minnow);
    grid.set(2, 3, Material.Mite, 90);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Mite)).toBe(0);
    expect(grid.count(Material.Gold)).toBeGreaterThanOrEqual(1);
  });

  it('eats bloom before neighboring plant', () => {
    const grid = new Grid(6, 5);
    stoneFloor(grid, 4);
    grid.set(2, 3, Material.Mite);
    grid.set(1, 3, Material.Plant);
    grid.set(3, 3, Material.Bloom);
    step(grid);
    expect(grid.count(Material.Bloom)).toBe(0);
    expect(grid.count(Material.Plant)).toBe(1);
  });

  it('climbs out of water toward sand instead of swimming', () => {
    const grid = new Grid(7, 5);
    stoneFloor(grid, 4);
    grid.set(1, 3, Material.Sand);
    grid.set(2, 3, Material.Water);
    grid.set(3, 3, Material.Water);
    grid.set(2, 3, Material.Mite);
    for (let i = 0; i < 24; i++) step(grid);
    expect(grid.count(Material.Mite)).toBe(1);
    const [mite] = positions(grid, Material.Mite);
    expect(mite.x).toBeLessThanOrEqual(1);
  });

  it('sends a minnow away from fire at the edge of the pool', () => {
    const grid = new Grid(7, 5);
    for (let x = 0; x < 7; x++) {
      grid.set(x, 2, Material.Stone);
      grid.set(x, 4, Material.Stone);
    }
    grid.set(0, 3, Material.Stone);
    grid.set(1, 3, Material.Water);
    grid.set(2, 3, Material.Minnow);
    grid.set(3, 3, Material.Water);
    grid.set(4, 3, Material.Fire);
    grid.set(5, 3, Material.Stone);
    step(grid);
    const [fish] = positions(grid, Material.Minnow);
    expect(fish.x).toBe(1);
  });
});
