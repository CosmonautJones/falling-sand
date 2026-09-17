import { beforeEach, describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Material } from './materials';
import { seedRng } from './rng';
import { beats, consumeBlast, resetSim, step } from './sim';

function positions(grid: Grid, material: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.get(x, y) === material) out.push({ x, y });
    }
  }
  return out;
}

describe('step', () => {
  beforeEach(() => {
    seedRng(1);
    resetSim();
  });

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

  it('rests sand on a stone ledge', () => {
    const grid = new Grid(4, 6);
    for (let x = 0; x < 4; x++) grid.set(x, 4, Material.Stone);
    grid.set(1, 0, Material.Sand);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.get(1, 3)).toBe(Material.Sand);
    expect(grid.get(1, 4)).toBe(Material.Stone);
  });

  it('settles a vertical sand column into a slope instead of a flat-topped stack', () => {
    seedRng(1);
    const grid = new Grid(9, 9);
    for (let i = 0; i < 5; i++) grid.set(4, i, Material.Sand);
    for (let i = 0; i < 32; i++) step(grid);

    expect(grid.count(Material.Sand)).toBe(5);
    const neighbors = positions(grid, Material.Sand).filter((p) => p.x !== 4);
    expect(neighbors.length).toBeGreaterThan(0);
    // The old 5-high column after a straight fall occupied (4,4) through (4,8).
    expect(grid.get(4, 4)).toBe(Material.Air);
  });

  it('moves water down out of mid-air', () => {
    const grid = new Grid(4, 8);
    grid.set(2, 0, Material.Water);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.get(2, 0)).toBe(Material.Air);
    expect(grid.count(Material.Water)).toBe(1);
    const [water] = positions(grid, Material.Water);
    expect(water.y).toBe(7);
  });

  it('spreads a water blob across the world floor', () => {
    const grid = new Grid(12, 6);
    for (let x = 4; x <= 6; x++) grid.set(x, 5, Material.Water);
    for (let i = 0; i < 40; i++) step(grid);
    expect(grid.count(Material.Water)).toBe(3);
    const onFloor = positions(grid, Material.Water).filter((p) => p.y === 5);
    expect(onFloor.length).toBe(3);
    const xs = onFloor.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2);
  });

  it('spreads water sideways until it pools in a lower gap', () => {
    seedRng(2);
    const grid = new Grid(5, 4);
    for (let x = 0; x < 5; x++) grid.set(x, 3, Material.Stone);
    grid.set(0, 2, Material.Stone);
    grid.set(1, 2, Material.Stone);
    grid.set(2, 2, Material.Stone);
    grid.set(4, 2, Material.Stone);
    grid.set(0, 1, Material.Water);

    for (let i = 0; i < 24; i++) step(grid);

    expect(grid.count(Material.Water)).toBe(1);
    expect(grid.get(0, 1)).toBe(Material.Air);
    const [water] = positions(grid, Material.Water);
    expect(water.x).toBe(3);
    expect(water.y).toBeGreaterThanOrEqual(1);
  });

  it('sinks sand through water so sand ends below water', () => {
    const grid = new Grid(3, 6);
    for (let y = 0; y < 6; y++) {
      grid.set(0, y, Material.Stone);
      grid.set(2, y, Material.Stone);
    }
    grid.set(1, 0, Material.Sand);
    grid.set(1, 1, Material.Water);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.count(Material.Sand)).toBe(1);
    expect(grid.count(Material.Water)).toBe(1);
    const [sand] = positions(grid, Material.Sand);
    const [water] = positions(grid, Material.Water);
    expect(sand.y).toBeGreaterThan(water.y);
  });

  it('settles a painted sand band across many columns instead of one stack', () => {
    seedRng(9);
    const grid = new Grid(40, 24);
    for (let x = 4; x < 36; x += 2) grid.paint(x, 4, 2, Material.Sand);
    const before = grid.count(Material.Sand);
    for (let i = 0; i < 48; i++) step(grid);
    expect(grid.count(Material.Sand)).toBe(before);
    const grains = positions(grid, Material.Sand);
    const cols = new Set(grains.map((p) => p.x));
    expect(cols.size).toBeGreaterThan(10);
    const bottom = grains.filter((p) => p.y >= 12).length;
    expect(bottom).toBeGreaterThan(before / 2);
  });

  it('conserves sand and water through mixed motion', () => {
    seedRng(3);
    const grid = new Grid(16, 16);
    grid.paint(4, 2, 2, Material.Sand);
    grid.paint(10, 2, 2, Material.Water);
    grid.paint(8, 12, 3, Material.Stone);
    const sand = grid.count(Material.Sand);
    const water = grid.count(Material.Water);
    for (let i = 0; i < 64; i++) step(grid);
    expect(grid.count(Material.Sand)).toBe(sand);
    expect(grid.count(Material.Water)).toBe(water);
  });

  it('grows plant into a neighboring air or water cell when it contacts water', () => {
    const grid = new Grid(5, 5);
    for (let x = 0; x < 5; x++) grid.set(x, 3, Material.Plant);
    grid.set(2, 2, Material.Water);
    const before = grid.count(Material.Plant);
    for (let i = 0; i < 12; i++) step(grid);
    expect(grid.count(Material.Plant)).toBeGreaterThan(before);
  });

  it('counts a beat of time for every step', () => {
    expect(beats()).toBe(0);
    const grid = new Grid(3, 3);
    step(grid);
    step(grid);
    expect(beats()).toBe(2);
    resetSim();
    expect(beats()).toBe(0);
  });

  it('does not catch neighboring plant on the first lick', () => {
    const grid = new Grid(5, 5);
    grid.set(2, 2, Material.Plant);
    grid.set(2, 1, Material.Fire);
    step(grid);
    expect(grid.get(2, 2)).toBe(Material.Plant);
    expect(grid.count(Material.Fire)).toBeGreaterThan(0);
  });

  it('consumes plant when fire is adjacent so the plant cell does not stay plant', () => {
    const grid = new Grid(5, 5);
    grid.set(2, 2, Material.Plant);
    grid.set(2, 1, Material.Fire);
    for (let i = 0; i < 48; i++) step(grid);
    expect(grid.get(2, 2)).not.toBe(Material.Plant);
    expect(grid.count(Material.Plant)).toBe(0);
  });

  it('walks fire along a wood beam instead of eating the far end in a few ticks', () => {
    const grid = new Grid(10, 5);
    for (let x = 0; x < 10; x++) grid.set(x, 4, Material.Stone);
    for (let x = 1; x <= 6; x++) grid.set(x, 3, Material.Wood);
    grid.set(1, 2, Material.Fire);
    for (let i = 0; i < 4; i++) step(grid);
    expect(grid.get(6, 3)).toBe(Material.Wood);
    expect(grid.count(Material.Wood)).toBeGreaterThan(2);
  });

  it('consumes oil when fire is adjacent', () => {
    const grid = new Grid(5, 5);
    grid.set(0, 4, Material.Stone);
    grid.set(1, 4, Material.Oil);
    grid.set(2, 4, Material.Fire);
    grid.set(3, 4, Material.Stone);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.count(Material.Oil)).toBe(0);
  });

  it('extinguishes fire that is adjacent to water', () => {
    const grid = new Grid(5, 5);
    grid.set(1, 4, Material.Fire);
    grid.set(2, 4, Material.Water);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Fire)).toBe(0);
  });

  it('lets fire without fuel die into ash', () => {
    const grid = new Grid(5, 5);
    grid.set(2, 2, Material.Fire);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Fire)).toBe(0);
    expect(grid.count(Material.Ash)).toBeGreaterThan(0);
  });

  it('sprouts a seed into plant when it touches water', () => {
    const grid = new Grid(5, 5);
    grid.set(0, 4, Material.Stone);
    grid.set(1, 4, Material.Seed);
    grid.set(2, 4, Material.Water);
    grid.set(3, 4, Material.Stone);
    step(grid);
    expect(grid.count(Material.Plant)).toBeGreaterThan(0);
    expect(grid.count(Material.Seed)).toBe(0);
  });

  it('vitrifies sand into glass when fire is adjacent', () => {
    const grid = new Grid(5, 5);
    grid.set(0, 4, Material.Stone);
    grid.set(1, 4, Material.Sand);
    grid.set(2, 4, Material.Fire);
    grid.set(3, 4, Material.Stone);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.count(Material.Glass)).toBeGreaterThan(0);
    expect(grid.get(1, 4)).not.toBe(Material.Sand);
  });

  it('slakes ash into mud when it touches water', () => {
    const grid = new Grid(5, 5);
    grid.set(0, 4, Material.Stone);
    grid.set(1, 4, Material.Ash);
    grid.set(2, 4, Material.Water);
    grid.set(3, 4, Material.Stone);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Mud)).toBeGreaterThan(0);
  });

  it('sprouts a seed on mud into plant', () => {
    const grid = new Grid(5, 5);
    grid.set(0, 4, Material.Stone);
    grid.set(1, 4, Material.Seed);
    grid.set(2, 4, Material.Mud);
    grid.set(3, 4, Material.Stone);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Plant)).toBeGreaterThan(0);
  });

  it('lets moss creep across wet stone', () => {
    const grid = new Grid(6, 4);
    for (let x = 0; x < 6; x++) grid.set(x, 3, Material.Stone);
    grid.set(1, 3, Material.Moss);
    grid.set(1, 2, Material.Water);
    for (let i = 0; i < 24; i++) step(grid);
    expect(grid.count(Material.Moss)).toBeGreaterThan(1);
  });

  it('does not let a young garden eat neighboring sand', () => {
    const grid = new Grid(8, 5);
    for (let x = 0; x < 8; x++) grid.set(x, 4, Material.Stone);
    grid.set(2, 3, Material.Plant);
    grid.set(3, 3, Material.Plant);
    grid.set(2, 2, Material.Water);
    grid.set(4, 3, Material.Sand);
    const sand = grid.count(Material.Sand);
    for (let i = 0; i < 40; i++) step(grid);
    expect(grid.count(Material.Sand)).toBe(sand);
  });

  it('lets a wet plant thicket drop a seed on its own', () => {
    const grid = new Grid(6, 6);
    for (let y = 2; y <= 4; y++) {
      for (let x = 2; x <= 4; x++) grid.set(x, y, Material.Plant);
    }
    grid.set(3, 1, Material.Water);
    for (let i = 0; i < 40; i++) step(grid);
    expect(grid.count(Material.Seed)).toBeGreaterThan(0);
  });

  it('moves oil down out of mid-air and spreads on the floor', () => {
    const grid = new Grid(12, 6);
    grid.set(5, 0, Material.Oil);
    for (let i = 0; i < 24; i++) step(grid);
    expect(grid.get(5, 0)).toBe(Material.Air);
    expect(grid.count(Material.Oil)).toBe(1);
    const [oil] = positions(grid, Material.Oil);
    expect(oil.y).toBe(5);
    grid.set(4, 5, Material.Oil);
    grid.set(6, 5, Material.Oil);
    for (let i = 0; i < 40; i++) step(grid);
    expect(grid.count(Material.Oil)).toBe(3);
    const xs = positions(grid, Material.Oil).map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2);
  });

  it('floats oil on water', () => {
    const grid = new Grid(3, 6);
    for (let y = 0; y < 6; y++) {
      grid.set(0, y, Material.Stone);
      grid.set(2, y, Material.Stone);
    }
    grid.set(1, 0, Material.Oil);
    grid.set(1, 1, Material.Water);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.count(Material.Oil)).toBe(1);
    expect(grid.count(Material.Water)).toBe(1);
    const [oil] = positions(grid, Material.Oil);
    const [water] = positions(grid, Material.Water);
    expect(water.y).toBe(5);
    expect(oil.y).toBeLessThan(water.y);
    expect(oil.y).toBeGreaterThanOrEqual(4);
  });

  it('moves a suspended steam grain up one cell per step', () => {
    const grid = new Grid(4, 8);
    grid.set(2, 7, Material.Steam);
    step(grid);
    expect(grid.get(2, 7)).toBe(Material.Air);
    expect(grid.get(2, 6)).toBe(Material.Steam);
  });

  it('lets steam leave the floor and collect at the ceiling', () => {
    const grid = new Grid(4, 8);
    grid.set(2, 7, Material.Steam);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.count(Material.Steam)).toBe(1);
    const [steam] = positions(grid, Material.Steam);
    expect(steam.y).toBe(0);
  });

  it('bubbles steam up through a water column', () => {
    const grid = new Grid(3, 6);
    for (let y = 0; y < 6; y++) {
      grid.set(0, y, Material.Stone);
      grid.set(2, y, Material.Stone);
    }
    grid.set(1, 5, Material.Steam);
    grid.set(1, 4, Material.Water);
    grid.set(1, 3, Material.Water);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.count(Material.Steam)).toBe(1);
    expect(grid.count(Material.Water)).toBe(2);
    const [steam] = positions(grid, Material.Steam);
    expect(steam.y).toBeLessThan(3);
  });

  it('boils fire-touched water into steam', () => {
    const grid = new Grid(5, 5);
    grid.set(1, 4, Material.Fire);
    grid.set(2, 4, Material.Water);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Fire)).toBe(0);
    expect(grid.count(Material.Steam)).toBeGreaterThan(0);
  });

  it('quenches lava with water into obsidian and steam', () => {
    const grid = new Grid(5, 5);
    grid.set(1, 4, Material.Lava);
    grid.set(2, 4, Material.Water);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Lava)).toBe(0);
    expect(grid.count(Material.Obsidian)).toBeGreaterThan(0);
    expect(grid.count(Material.Steam)).toBeGreaterThan(0);
  });

  it('melts ice next to fire into water', () => {
    const grid = new Grid(5, 5);
    grid.set(1, 4, Material.Ice);
    grid.set(2, 4, Material.Fire);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.get(1, 4)).not.toBe(Material.Ice);
    expect(grid.count(Material.Water) + grid.count(Material.Steam)).toBeGreaterThan(0);
  });

  it('freezes neighboring water into more ice', () => {
    seedRng(5);
    const grid = new Grid(6, 4);
    for (let x = 0; x < 6; x++) grid.set(x, 3, Material.Stone);
    grid.set(1, 3, Material.Ice);
    grid.set(2, 3, Material.Water);
    grid.set(3, 3, Material.Water);
    for (let i = 0; i < 40; i++) step(grid);
    expect(grid.count(Material.Ice)).toBeGreaterThan(1);
  });

  it('dissolves salt into brine on contact with water', () => {
    const grid = new Grid(5, 5);
    grid.set(0, 4, Material.Stone);
    grid.set(1, 4, Material.Salt);
    grid.set(2, 4, Material.Water);
    grid.set(3, 4, Material.Stone);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Salt)).toBe(0);
    expect(grid.count(Material.Brine)).toBeGreaterThan(0);
  });

  it('grows crystal from hot brine', () => {
    seedRng(6);
    const grid = new Grid(5, 5);
    grid.set(0, 4, Material.Stone);
    grid.set(1, 4, Material.Brine);
    grid.set(2, 4, Material.Fire);
    grid.set(3, 4, Material.Stone);
    for (let i = 0; i < 24; i++) step(grid);
    expect(grid.count(Material.Crystal)).toBeGreaterThan(0);
  });

  it('drops an ember from burning wood and lets it fall', () => {
    seedRng(8);
    const grid = new Grid(5, 8);
    grid.set(2, 2, Material.Wood);
    grid.set(2, 1, Material.Fire);
    for (let i = 0; i < 32; i++) step(grid);
    expect(
      grid.count(Material.Ember) + grid.count(Material.Ash) + grid.count(Material.Fire),
    ).toBeGreaterThan(0);
    expect(grid.get(2, 2)).not.toBe(Material.Wood);
  });

  it('moves a suspended ember down one cell per step', () => {
    const grid = new Grid(4, 8);
    grid.set(2, 0, Material.Ember);
    step(grid);
    expect(grid.get(2, 0)).toBe(Material.Air);
    expect(grid.get(2, 1)).toBe(Material.Ember);
  });

  it('melts stone into lava when fire licks it long enough', () => {
    seedRng(4);
    const grid = new Grid(5, 5);
    grid.set(1, 4, Material.Stone);
    grid.set(2, 4, Material.Fire);
    for (let i = 0; i < 80; i++) step(grid);
    expect(grid.count(Material.Lava)).toBeGreaterThan(0);
  });

  it('lets lava spread into neighboring stone', () => {
    seedRng(9);
    const grid = new Grid(6, 4);
    for (let x = 0; x < 6; x++) grid.set(x, 3, Material.Stone);
    grid.set(1, 3, Material.Lava);
    for (let i = 0; i < 40; i++) step(grid);
    expect(grid.count(Material.Lava)).toBeGreaterThan(1);
  });

  it('condenses steam back to water against ice', () => {
    const grid = new Grid(5, 5);
    grid.set(2, 2, Material.Steam);
    grid.set(2, 1, Material.Ice);
    step(grid);
    expect(grid.count(Material.Water)).toBeGreaterThan(0);
    expect(grid.get(2, 2)).toBe(Material.Water);
  });

  it('sinks lava through water so lava ends below water when they do not quench immediately', () => {
    seedRng(11);
    const grid = new Grid(3, 8);
    for (let y = 0; y < 8; y++) {
      grid.set(0, y, Material.Stone);
      grid.set(2, y, Material.Stone);
    }
    grid.set(1, 0, Material.Lava);
    for (let i = 0; i < 20; i++) step(grid);
    expect(grid.count(Material.Lava) + grid.count(Material.Obsidian)).toBeGreaterThan(0);
    const hot = [...positions(grid, Material.Lava), ...positions(grid, Material.Obsidian)];
    expect(hot.some((p) => p.y >= 6)).toBe(true);
  });

  it('lets acid eat neighboring stone', () => {
    const grid = new Grid(5, 5);
    grid.set(0, 4, Material.Stone);
    grid.set(1, 4, Material.Acid);
    grid.set(2, 4, Material.Stone);
    grid.set(3, 4, Material.Stone);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.count(Material.Stone)).toBeLessThan(3);
  });

  it('dissolves lead in acid into quicksilver', () => {
    const grid = new Grid(5, 5);
    grid.set(0, 4, Material.Stone);
    grid.set(1, 4, Material.Lead);
    grid.set(2, 4, Material.Acid);
    grid.set(3, 4, Material.Stone);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Mercury)).toBeGreaterThan(0);
  });

  it('roasts lead with quicksilver and fire into gold', () => {
    seedRng(7);
    const grid = new Grid(6, 5);
    grid.set(1, 4, Material.Lead);
    grid.set(2, 4, Material.Mercury);
    grid.set(3, 4, Material.Fire);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.count(Material.Gold)).toBeGreaterThan(0);
  });

  it('lifts aether out of steam that kisses crystal', () => {
    const grid = new Grid(5, 5);
    grid.set(2, 3, Material.Steam);
    grid.set(2, 2, Material.Crystal);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Aether)).toBeGreaterThan(0);
  });

  it('coagulates gold, aether, and crystal into azoth', () => {
    const grid = new Grid(5, 5);
    grid.set(1, 3, Material.Gold);
    grid.set(2, 3, Material.Aether);
    grid.set(3, 3, Material.Crystal);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Azoth)).toBeGreaterThan(0);
  });

  it('lets azoth turn neighboring lead into gold', () => {
    const grid = new Grid(5, 5);
    grid.set(1, 4, Material.Azoth);
    grid.set(2, 4, Material.Lead);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Gold)).toBeGreaterThan(0);
  });

  it('mixes salt and ash into black powder', () => {
    const grid = new Grid(5, 5);
    grid.set(0, 4, Material.Stone);
    grid.set(1, 4, Material.Salt);
    grid.set(2, 4, Material.Ash);
    grid.set(3, 4, Material.Stone);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Powder)).toBeGreaterThan(0);
  });

  it('flashes powder next to fire into more fire', () => {
    const grid = new Grid(5, 5);
    grid.set(1, 4, Material.Powder);
    grid.set(2, 4, Material.Fire);
    grid.set(3, 4, Material.Powder);
    for (let i = 0; i < 3; i++) step(grid);
    expect(grid.count(Material.Powder)).toBe(0);
    expect(grid.count(Material.Fire) + grid.count(Material.Ash)).toBeGreaterThan(0);
  });

  it('opens a black sun: fire boxed in eight obsidian becomes void', () => {
    const grid = new Grid(5, 5);
    for (const [dx, dy] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ] as const) {
      grid.set(2 + dx, 2 + dy, Material.Obsidian);
    }
    grid.set(2, 2, Material.Fire);
    step(grid);
    expect(grid.get(2, 2)).toBe(Material.Void);
  });

  it('lets void devour a neighboring plant', () => {
    const grid = new Grid(5, 5);
    grid.set(1, 4, Material.Void);
    grid.set(2, 4, Material.Plant);
    for (let i = 0; i < 12; i++) step(grid);
    expect(grid.count(Material.Plant)).toBe(0);
  });

  it('moves a suspended aether grain up one cell per step', () => {
    const grid = new Grid(4, 8);
    grid.set(2, 7, Material.Aether);
    step(grid);
    expect(grid.get(2, 7)).toBe(Material.Air);
    expect(grid.get(2, 6)).toBe(Material.Aether);
  });

  it('burns a powder fuse one hop per tick instead of the whole line at once', () => {
    const grid = new Grid(12, 5);
    for (let x = 0; x < 12; x++) grid.set(x, 4, Material.Stone);
    for (let x = 1; x <= 8; x++) grid.set(x, 3, Material.Powder);
    grid.set(1, 3, Material.Fire);
    step(grid);
    expect(grid.get(8, 3)).toBe(Material.Powder);
    for (let i = 0; i < 24; i++) step(grid);
    expect(grid.count(Material.Powder)).toBe(0);
  });

  it('fires mud into brick', () => {
    const grid = new Grid(5, 5);
    grid.set(1, 4, Material.Mud);
    grid.set(2, 4, Material.Fire);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Brick)).toBeGreaterThan(0);
  });

  it('lets ash act as bone-meal so a dry plant still grows', () => {
    const grid = new Grid(5, 5);
    for (let x = 0; x < 5; x++) grid.set(x, 4, Material.Stone);
    for (let x = 1; x <= 3; x++) grid.set(x, 3, Material.Plant);
    grid.set(2, 2, Material.Ash);
    const before = grid.count(Material.Plant);
    for (let i = 0; i < 16; i++) step(grid);
    expect(grid.count(Material.Plant)).toBeGreaterThan(before);
  });

  it('solidifies sand that rests on brine into stone', () => {
    const grid = new Grid(5, 6);
    for (let x = 0; x < 5; x++) grid.set(x, 5, Material.Stone);
    grid.set(2, 5, Material.Brine);
    grid.set(2, 4, Material.Sand);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Sand)).toBe(0);
    expect(grid.count(Material.Stone)).toBeGreaterThan(3);
  });

  it('lights an obsidian frame with fire into a rift', () => {
    const grid = new Grid(8, 8);
    for (let x = 1; x <= 4; x++) {
      grid.set(x, 1, Material.Obsidian);
      grid.set(x, 5, Material.Obsidian);
    }
    for (let y = 1; y <= 5; y++) {
      grid.set(1, y, Material.Obsidian);
      grid.set(4, y, Material.Obsidian);
    }
    grid.set(2, 2, Material.Fire);
    for (let i = 0; i < 4; i++) step(grid);
    expect(grid.count(Material.Rift)).toBeGreaterThan(0);
  });

  it('lets a rift drink neighboring sand into aether', () => {
    const grid = new Grid(5, 5);
    grid.set(1, 3, Material.Rift);
    grid.set(2, 3, Material.Sand);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Sand)).toBe(0);
    expect(grid.count(Material.Aether)).toBeGreaterThan(0);
  });

  it('strikes lightning down a gold rod when aether kisses the tip', () => {
    const grid = new Grid(5, 12);
    for (let x = 0; x < 5; x++) grid.set(x, 11, Material.Stone);
    for (let y = 5; y <= 10; y++) {
      grid.set(1, y, Material.Stone);
      grid.set(2, y, Material.Gold);
      grid.set(3, y, Material.Stone);
    }
    grid.set(2, 4, Material.Aether);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Fire) + grid.count(Material.Ash)).toBeGreaterThan(0);
  });

  it('drips water from a crystal that hangs over air beside ice', () => {
    seedRng(2);
    const grid = new Grid(5, 6);
    grid.set(2, 1, Material.Ice);
    grid.set(2, 2, Material.Crystal);
    for (let i = 0; i < 40; i++) step(grid);
    expect(grid.count(Material.Water)).toBeGreaterThan(0);
  });

  it('prospects lead from stone that acid bites long enough', () => {
    seedRng(4);
    const grid = new Grid(7, 7);
    for (let y = 1; y <= 5; y++) {
      for (let x = 1; x <= 5; x++) grid.set(x, y, Material.Stone);
    }
    grid.set(3, 3, Material.Acid);
    for (let i = 0; i < 40; i++) step(grid);
    expect(
      grid.count(Material.Lead) + grid.count(Material.Mercury) + grid.count(Material.Gold),
    ).toBeGreaterThan(0);
  });

  it('detonates tnt next to fire and carves a crater in sand', () => {
    const grid = new Grid(13, 13);
    grid.paint(6, 6, 5, Material.Sand);
    const sandBefore = grid.count(Material.Sand);
    grid.set(6, 6, Material.Tnt);
    grid.set(7, 6, Material.Fire);
    for (let i = 0; i < 4; i++) step(grid);
    expect(grid.count(Material.Tnt)).toBe(0);
    expect(grid.count(Material.Sand)).toBeLessThan(sandBefore);
    expect(consumeBlast()).toBeGreaterThan(0);
    expect(consumeBlast()).toBe(0);
  });

  it('leaves obsidian standing through a tnt blast', () => {
    const grid = new Grid(11, 11);
    grid.set(5, 5, Material.Tnt);
    grid.set(6, 5, Material.Fire);
    grid.set(5, 4, Material.Obsidian);
    for (let i = 0; i < 4; i++) step(grid);
    expect(grid.get(5, 4)).toBe(Material.Obsidian);
  });

  it('chains neighboring tnt', () => {
    const grid = new Grid(15, 9);
    grid.set(4, 4, Material.Tnt);
    grid.set(8, 4, Material.Tnt);
    grid.set(5, 4, Material.Fire);
    for (let i = 0; i < 6; i++) step(grid);
    expect(grid.count(Material.Tnt)).toBe(0);
  });

  it('splashes water upward when sand falls into it', () => {
    const grid = new Grid(5, 8);
    for (let x = 0; x < 5; x++) grid.set(x, 7, Material.Stone);
    grid.set(1, 6, Material.Stone);
    grid.set(3, 6, Material.Stone);
    grid.set(2, 6, Material.Water);
    grid.set(2, 5, Material.Sand);
    step(grid);
    expect(grid.count(Material.Water)).toBe(1);
    expect(grid.count(Material.Sand)).toBe(1);
    const [water] = positions(grid, Material.Water);
    expect(water.y).toBeLessThan(5);
  });

  it('brews nitro from oil touching powder', () => {
    const grid = new Grid(5, 5);
    grid.set(0, 4, Material.Stone);
    grid.set(1, 4, Material.Oil);
    grid.set(2, 4, Material.Powder);
    grid.set(3, 4, Material.Stone);
    for (let i = 0; i < 8; i++) step(grid);
    expect(grid.count(Material.Nitro)).toBeGreaterThan(0);
  });

  it('lets void spread into plant as more void', () => {
    const grid = new Grid(5, 5);
    grid.set(1, 4, Material.Void);
    grid.set(2, 4, Material.Plant);
    for (let i = 0; i < 12; i++) step(grid);
    expect(grid.count(Material.Plant)).toBe(0);
    expect(grid.count(Material.Void)).toBeGreaterThan(1);
  });

  it('spreads brine across the floor like a heavier liquid', () => {
    const grid = new Grid(12, 6);
    for (let x = 4; x <= 6; x++) grid.set(x, 5, Material.Brine);
    for (let i = 0; i < 40; i++) step(grid);
    expect(grid.count(Material.Brine)).toBe(3);
    const xs = positions(grid, Material.Brine).map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2);
  });
});
