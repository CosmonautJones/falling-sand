import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material } from './materials';
import { seedRng } from './rng';
import { resetSim, step } from './sim';
import { HEIGHT, WIDTH, seedVessel } from './world';

function plantNeighbor(grid: Grid, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const id = grid.get(x + dx, y + dy);
      if (id === Material.Plant || id === Material.Bloom) return true;
    }
  }
  return false;
}

function mudPiles(grid: Grid): { nest: number; loose: number } {
  let nest = 0;
  let loose = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.get(x, y) !== Material.Mud) continue;
      if (plantNeighbor(grid, x, y)) nest++;
      else loose++;
    }
  }
  return { nest, loose };
}

describe('vessel', () => {
  it('keeps the opening lava inside its glass cup instead of melting the floor', () => {
    seedRng(7);
    resetSim();
    const grid = new Grid(WIDTH, HEIGHT);
    seedVessel(grid);
    const lava = grid.count(Material.Lava);

    for (let tick = 1; tick <= 120; tick++) step(grid);

    expect(grid.count(Material.Lava)).toBe(lava);
    for (let i = 0; i < grid.cells.length; i++) {
      if (grid.cells[i] !== Material.Lava) continue;
      const x = i % WIDTH;
      const y = Math.floor(i / WIDTH);
      expect(x).toBeGreaterThan(410);
      expect(x).toBeLessThan(434);
      expect(y).toBeGreaterThanOrEqual(249);
      expect(y).toBeLessThan(264);
    }
    for (let x = 410; x <= 434; x++) {
      expect(grid.get(x, 264)).toBe(Material.Glass);
      expect(grid.get(x, 265)).toBe(Material.Stone);
    }
  });

  it.each([
    { width: 480, height: 270, ground: 265, wall: 5 },
    { width: 96, height: 54, ground: 51, wall: 3 },
  ])(
    'keeps terrain inside the $width by $height stone enclosure',
    ({ width, height, ground, wall }) => {
      seedRng(7);
      const grid = new Grid(width, height);
      seedVessel(grid);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (y >= ground || x < wall || x >= width - wall) {
            expect(grid.get(x, y), `enclosure at ${x},${y}`).toBe(Material.Stone);
          }
        }
      }
    },
  );

  it.each([1, 7, 42])(
    'keeps nursery mud against forage through 1800 steps with seed %i',
    (seed) => {
      seedRng(seed);
      resetSim();
      const grid = new Grid(WIDTH, HEIGHT);
      seedVessel(grid);

      for (let tick = 1; tick <= 1800; tick++) {
        step(grid);
        if (tick !== 10 && tick % 60 !== 0) continue;
        for (const x of [131, 132]) {
          expect(grid.get(x, 264), `nursery mud at ${x},264 after step ${tick}`).toBe(Material.Mud);
          let forage = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const id = grid.get(x + dx, 264 + dy);
              if (id === Material.Plant || id === Material.Bloom) forage = true;
            }
          }
          expect(forage, `nursery forage near ${x},264 after step ${tick}`).toBe(true);
        }
      }
    },
    30_000,
  );

  it('is a wide playfield, not a postage stamp', () => {
    expect(WIDTH).toBeGreaterThanOrEqual(420);
    expect(HEIGHT).toBeGreaterThanOrEqual(240);
    expect(WIDTH * HEIGHT).toBeGreaterThan(100_000);
  });

  it('seeds a loose mud donor on the dune, away from the nursery plants', () => {
    seedRng(7);
    const grid = new Grid(WIDTH, HEIGHT);
    seedVessel(grid);
    const piles = mudPiles(grid);
    expect(piles.nest).toBeGreaterThanOrEqual(2);
    expect(piles.loose).toBeGreaterThanOrEqual(4);
  });

  it('lets mites haul donor mud without stripping the nursery', () => {
    seedRng(1);
    resetSim();
    const grid = new Grid(WIDTH, HEIGHT);
    seedVessel(grid);
    for (let i = 0; i < 240; i++) step(grid);
    expect(grid.get(131, 264)).toBe(Material.Mud);
    expect(grid.get(132, 264)).toBe(Material.Mud);
    expect(plantNeighbor(grid, 131, 264)).toBe(true);
    let laden = 0;
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.get(x, y) === Material.Mite && grid.getShade(x, y) <= -40) laden++;
      }
    }
    const piles = mudPiles(grid);
    expect(laden + piles.loose).toBeGreaterThan(0);
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
    expect(grid.count(Material.Mite)).toBeGreaterThan(0);
    expect(grid.count(Material.Minnow)).toBeGreaterThan(0);
  });
});
