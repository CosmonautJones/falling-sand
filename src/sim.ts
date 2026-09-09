import { Grid } from './grid';
import { Material, MATERIALS, SHADE_RANGE, type MaterialId } from './materials';
import { randInt, randShade } from './rng';

let scanDir: 1 | -1 = 1;
let bornBuf: Uint8Array | null = null;
let blastKick = 0;

export function consumeBlast(): number {
  const kick = blastKick;
  blastKick = 0;
  return kick;
}

const N8: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

export function resetSim(): void {
  scanDir = 1;
  blastKick = 0;
}

function heavier(src: MaterialId, dst: MaterialId): boolean {
  return MATERIALS[src].density > MATERIALS[dst].density;
}

function trySwap(grid: Grid, x: number, y: number, nx: number, ny: number): boolean {
  const dst = grid.get(nx, ny);
  if (!MATERIALS[dst].movable) return false;
  if (!heavier(grid.get(x, y), dst)) return false;
  grid.swap(x, y, nx, ny);
  return true;
}

/** Rise into a denser movable cell (steam through air or water). */
function trySwapUp(grid: Grid, x: number, y: number, nx: number, ny: number): boolean {
  const dst = grid.get(nx, ny);
  if (!MATERIALS[dst].movable) return false;
  if (MATERIALS[grid.get(x, y)].density >= MATERIALS[dst].density) return false;
  grid.swap(x, y, nx, ny);
  return true;
}

function splashUp(grid: Grid, x: number, y: number, born: Uint8Array): void {
  if (MATERIALS[grid.get(x, y)].kind !== 'liquid') return;
  if (trySwap(grid, x, y, x, y - 1)) {
    markBorn(grid, born, x, y - 1);
    return;
  }
  const side = randInt(2) === 0 ? -1 : 1;
  if (trySwap(grid, x, y, x + side, y - 1)) {
    markBorn(grid, born, x + side, y - 1);
    return;
  }
  if (trySwap(grid, x, y, x - side, y - 1)) markBorn(grid, born, x - side, y - 1);
}

/** Fall straight down, then slide down a slope (angle of repose). */
function tryDownAndDiags(grid: Grid, x: number, y: number, born: Uint8Array): boolean {
  const below = grid.get(x, y + 1);
  if (trySwap(grid, x, y, x, y + 1)) {
    if (MATERIALS[below].kind === 'liquid') splashUp(grid, x, y, born);
    return true;
  }
  const first = randInt(2) === 0 ? -1 : 1;
  if (trySwap(grid, x, y, x + first, y + 1)) return true;
  if (trySwap(grid, x, y, x - first, y + 1)) return true;
  return false;
}

function tryLiquid(grid: Grid, x: number, y: number, dir: 1 | -1, born: Uint8Array): number {
  if (tryDownAndDiags(grid, x, y, born)) return 0;
  const first = randInt(2) === 0 ? -1 : 1;
  if (trySwap(grid, x, y, x + first, y)) return first === dir ? dir : 0;
  if (trySwap(grid, x, y, x - first, y)) return -first === dir ? dir : 0;
  return 0;
}

function markBorn(grid: Grid, born: Uint8Array, x: number, y: number): void {
  if (grid.inBounds(x, y)) born[grid.index(x, y)] = 1;
}

function tryGas(grid: Grid, x: number, y: number, dir: 1 | -1, born: Uint8Array): number {
  if (trySwapUp(grid, x, y, x, y - 1)) {
    markBorn(grid, born, x, y - 1);
    return 0;
  }
  const first = randInt(2) === 0 ? -1 : 1;
  if (trySwapUp(grid, x, y, x + first, y - 1)) {
    markBorn(grid, born, x + first, y - 1);
    return 0;
  }
  if (trySwapUp(grid, x, y, x - first, y - 1)) {
    markBorn(grid, born, x - first, y - 1);
    return 0;
  }
  if (trySwapUp(grid, x, y, x + first, y)) {
    markBorn(grid, born, x + first, y);
    return first === dir ? dir : 0;
  }
  if (trySwapUp(grid, x, y, x - first, y)) {
    markBorn(grid, born, x - first, y);
    return -first === dir ? dir : 0;
  }
  return 0;
}

function hasNeighbor(grid: Grid, x: number, y: number, want: MaterialId): boolean {
  for (const [dx, dy] of N8) {
    if (grid.get(x + dx, y + dy) === want) return true;
  }
  return false;
}

function transmute(grid: Grid, x: number, y: number, into: MaterialId, born: Uint8Array): void {
  if (!grid.inBounds(x, y)) return;
  grid.set(x, y, into, randShade(SHADE_RANGE[into]));
  born[grid.index(x, y)] = 1;
}

function wetNeighbor(grid: Grid, x: number, y: number): boolean {
  return hasNeighbor(grid, x, y, Material.Water) || hasNeighbor(grid, x, y, Material.Brine);
}

function growPlant(grid: Grid, x: number, y: number, born: Uint8Array): void {
  let wet = false;
  let plants = 0;
  const air: Array<[number, number]> = [];
  const grow: Array<[number, number]> = [];
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    const n = grid.get(nx, ny);
    if (n === Material.Water || n === Material.Ash) wet = true;
    if (n === Material.Plant) plants++;
    if (n === Material.Air) air.push([nx, ny]);
    if (n === Material.Air || n === Material.Water) grow.push([nx, ny]);
  }
  if (wet && plants >= 2 && air.length > 0 && randInt(6) === 0) {
    const [nx, ny] = air[randInt(air.length)];
    transmute(grid, nx, ny, Material.Seed, born);
    return;
  }
  if (!wet || grow.length === 0) return;
  const [nx, ny] = grow[randInt(grow.length)];
  transmute(grid, nx, ny, Material.Plant, born);
}

function creepMoss(grid: Grid, x: number, y: number, born: Uint8Array): void {
  if (!hasNeighbor(grid, x, y, Material.Water) && !hasNeighbor(grid, x, y, Material.Mud)) return;
  if (randInt(3) !== 0) return;
  const stones: Array<[number, number]> = [];
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (grid.get(nx, ny) === Material.Stone) stones.push([nx, ny]);
  }
  if (stones.length === 0) return;
  const [nx, ny] = stones[randInt(stones.length)];
  transmute(grid, nx, ny, Material.Moss, born);
}

function blastHard(n: MaterialId): boolean {
  return n === Material.Obsidian || n === Material.Azoth || n === Material.Rift;
}

function detonate(
  grid: Grid,
  cx: number,
  cy: number,
  radius: number,
  born: Uint8Array,
  seen?: Set<number>,
): void {
  const hit = seen ?? new Set<number>();
  const origin = cy * 1024 + cx;
  if (hit.has(origin)) return;
  hit.add(origin);
  blastKick = Math.max(blastKick, radius);
  const chain: Array<[number, number, number]> = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > radius * radius) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (!grid.inBounds(nx, ny)) continue;
      const n = grid.get(nx, ny);
      if (blastHard(n)) continue;
      if ((n === Material.Tnt || n === Material.Nitro) && d2 > 0) {
        chain.push([nx, ny, n === Material.Nitro ? 6 : 4]);
        continue;
      }
      if (MATERIALS[n].kind === 'powder' && d2 > 1) {
        const tx = cx + Math.round(dx * 1.7);
        const ty = cy + Math.round(dy * 1.7);
        if (grid.inBounds(tx, ty) && grid.get(tx, ty) === Material.Air) {
          grid.swap(nx, ny, tx, ty);
          markBorn(grid, born, tx, ty);
          continue;
        }
      }
      if (n === Material.Water || n === Material.Brine) {
        transmute(grid, nx, ny, Material.Steam, born);
      } else if (d2 <= 2) {
        transmute(grid, nx, ny, Material.Fire, born);
      } else {
        transmute(grid, nx, ny, Material.Air, born);
      }
    }
  }

  for (const [x, y, r] of chain) detonate(grid, x, y, r, born, hit);
}

function igniteCell(grid: Grid, nx: number, ny: number, n: MaterialId, born: Uint8Array): boolean {
  if (!grid.inBounds(nx, ny)) return false;
  if (n === Material.Plant || n === Material.Oil || n === Material.Seed) {
    transmute(grid, nx, ny, Material.Fire, born);
    return true;
  }
  if (n === Material.Wood) {
    transmute(grid, nx, ny, randInt(2) === 0 ? Material.Fire : Material.Ember, born);
    return true;
  }
  if (n === Material.Sand) {
    transmute(grid, nx, ny, Material.Glass, born);
    return true;
  }
  if (n === Material.Ice) {
    transmute(grid, nx, ny, Material.Water, born);
    return true;
  }
  if (n === Material.Stone) {
    if (randInt(6) === 0) transmute(grid, nx, ny, Material.Lava, born);
    return true;
  }
  if (n === Material.Brine) {
    transmute(grid, nx, ny, Material.Crystal, born);
    return true;
  }
  if (n === Material.Powder) {
    transmute(grid, nx, ny, Material.Fire, born);
    return true;
  }
  if (n === Material.Mud) {
    transmute(grid, nx, ny, Material.Brick, born);
    return true;
  }
  if (n === Material.Tnt) {
    detonate(grid, nx, ny, 4, born);
    return true;
  }
  if (n === Material.Nitro) {
    detonate(grid, nx, ny, 6, born);
    return true;
  }
  return false;
}

function burn(grid: Grid, x: number, y: number, born: Uint8Array): void {
  let wet = false;
  let fueled = false;
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    const n = grid.get(nx, ny);
    if (n === Material.Water || n === Material.Brine) wet = true;
    if (igniteCell(grid, nx, ny, n, born)) fueled = true;
  }
  if (wet) {
    transmute(grid, x, y, Material.Steam, born);
    return;
  }
  if (!fueled) transmute(grid, x, y, Material.Ash, born);
}

function smolderEmber(grid: Grid, x: number, y: number, born: Uint8Array): boolean {
  let fueled = false;
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (igniteCell(grid, nx, ny, grid.get(nx, ny), born)) fueled = true;
  }
  return fueled;
}

function cookLava(grid: Grid, x: number, y: number, born: Uint8Array): boolean {
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (!grid.inBounds(nx, ny)) continue;
    const n = grid.get(nx, ny);
    if (n === Material.Water || n === Material.Brine) {
      transmute(grid, nx, ny, Material.Steam, born);
      transmute(grid, x, y, Material.Obsidian, born);
      return true;
    }
    if (n === Material.Ice) {
      transmute(grid, nx, ny, Material.Steam, born);
      transmute(grid, x, y, Material.Obsidian, born);
      return true;
    }
    if (n === Material.Stone && randInt(12) === 0) {
      transmute(grid, nx, ny, Material.Lava, born);
    }
    if (n === Material.Sand) transmute(grid, nx, ny, Material.Glass, born);
    if (n === Material.Plant || n === Material.Wood || n === Material.Seed || n === Material.Oil) {
      transmute(grid, nx, ny, Material.Fire, born);
    }
  }
  return false;
}

function cookAcid(grid: Grid, x: number, y: number, born: Uint8Array): boolean {
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (!grid.inBounds(nx, ny)) continue;
    const n = grid.get(nx, ny);
    if (n === Material.Lead) {
      transmute(grid, nx, ny, Material.Mercury, born);
      return false;
    }
    if (n === Material.Salt) {
      transmute(grid, x, y, Material.Water, born);
      return true;
    }
    if (n === Material.Stone) {
      const ore =
        randInt(18) === 0 ? Material.Gold : randInt(3) === 0 ? Material.Lead : Material.Sand;
      transmute(grid, nx, ny, ore, born);
      return false;
    }
    if (n === Material.Plant || n === Material.Wood || n === Material.Moss || n === Material.Mud) {
      transmute(grid, nx, ny, Material.Air, born);
      return false;
    }
  }
  return false;
}

function devour(grid: Grid, x: number, y: number, born: Uint8Array): void {
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (!grid.inBounds(nx, ny)) continue;
    const n = grid.get(nx, ny);
    if (
      n === Material.Air ||
      n === Material.Stone ||
      n === Material.Glass ||
      n === Material.Obsidian ||
      n === Material.Azoth ||
      n === Material.Void ||
      n === Material.Crystal ||
      n === Material.Rift ||
      n === Material.Brick
    ) {
      continue;
    }
    const life =
      n === Material.Plant || n === Material.Wood || n === Material.Seed || n === Material.Moss;
    transmute(grid, nx, ny, life && !hasNeighbor(grid, x, y, Material.Azoth) ? Material.Void : Material.Air, born);
    return;
  }
}

function obsidianBox(grid: Grid, x: number, y: number): boolean {
  let n = 0;
  for (const [dx, dy] of N8) {
    if (grid.get(x + dx, y + dy) === Material.Obsidian) n++;
  }
  return n === 8;
}

function isPortalOpen(grid: Grid, x: number, y: number): boolean {
  const n = grid.get(x, y);
  return n === Material.Air || n === Material.Fire || n === Material.Rift;
}

function rowOpen(grid: Grid, x0: number, x1: number, y: number): boolean {
  for (let x = x0; x <= x1; x++) {
    if (!isPortalOpen(grid, x, y)) return false;
  }
  return true;
}

function obsidianRing(grid: Grid, x0: number, y0: number, x1: number, y1: number): boolean {
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    if (grid.get(x, y0 - 1) !== Material.Obsidian) return false;
    if (grid.get(x, y1 + 1) !== Material.Obsidian) return false;
  }
  for (let y = y0; y <= y1; y++) {
    if (grid.get(x0 - 1, y) !== Material.Obsidian) return false;
    if (grid.get(x1 + 1, y) !== Material.Obsidian) return false;
  }
  return true;
}

function innerAirRect(
  grid: Grid,
  x: number,
  y: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!isPortalOpen(grid, x, y)) return null;
  let x0 = x;
  let x1 = x;
  let y0 = y;
  let y1 = y;
  while (isPortalOpen(grid, x0 - 1, y)) x0 -= 1;
  while (isPortalOpen(grid, x1 + 1, y)) x1 += 1;
  while (rowOpen(grid, x0, x1, y0 - 1)) y0 -= 1;
  while (rowOpen(grid, x0, x1, y1 + 1)) y1 += 1;
  for (let yy = y0; yy <= y1; yy++) {
    if (!rowOpen(grid, x0, x1, yy)) return null;
  }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w < 2 || h < 2 || w > 24 || h > 24) return null;
  return { x0, y0, x1, y1 };
}

function tryLightPortal(grid: Grid, x: number, y: number, born: Uint8Array): boolean {
  const rect = innerAirRect(grid, x, y);
  if (!rect) return false;
  if (!obsidianRing(grid, rect.x0, rect.y0, rect.x1, rect.y1)) return false;
  for (let yy = rect.y0; yy <= rect.y1; yy++) {
    for (let xx = rect.x0; xx <= rect.x1; xx++) {
      transmute(grid, xx, yy, Material.Rift, born);
    }
  }
  return true;
}

function goldColumn(grid: Grid, x: number, y: number): number {
  let n = 0;
  let cy = y;
  while (grid.get(x, cy) === Material.Gold) {
    n += 1;
    cy += 1;
  }
  return n;
}

function strikeRod(grid: Grid, x: number, y: number, born: Uint8Array): boolean {
  if (grid.get(x, y + 1) !== Material.Gold) return false;
  if (goldColumn(grid, x, y + 1) < 6) return false;
  let bottom = y + 1;
  while (grid.get(x, bottom + 1) === Material.Gold) bottom += 1;
  transmute(grid, x, y, Material.Air, born);
  transmute(grid, x, bottom, Material.Fire, born);
  return true;
}

function riftPull(grid: Grid, x: number, y: number, born: Uint8Array): void {
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (!grid.inBounds(nx, ny)) continue;
    const n = grid.get(nx, ny);
    if (
      n === Material.Air ||
      n === Material.Obsidian ||
      n === Material.Rift ||
      n === Material.Azoth ||
      n === Material.Glass ||
      n === Material.Crystal ||
      n === Material.Gold ||
      n === Material.Stone ||
      n === Material.Brick
    ) {
      continue;
    }
    transmute(grid, nx, ny, Material.Aether, born);
    return;
  }
}

function freezeWater(grid: Grid, x: number, y: number, born: Uint8Array): void {
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (!grid.inBounds(nx, ny)) continue;
    if (born[grid.index(nx, ny)]) continue;
    if (grid.get(nx, ny) === Material.Water && randInt(6) === 0) {
      transmute(grid, nx, ny, Material.Ice, born);
    }
  }
}

/**
 * Reactions that consume or replace the current cell.
 * Returns true when the cell should not also move this tick.
 */
function react(grid: Grid, x: number, y: number, material: MaterialId, born: Uint8Array): boolean {
  if (material === Material.Seed) {
    if (hasNeighbor(grid, x, y, Material.Water) || hasNeighbor(grid, x, y, Material.Mud)) {
      transmute(grid, x, y, Material.Plant, born);
      return true;
    }
    return false;
  }
  if (material === Material.Ash) {
    if (hasNeighbor(grid, x, y, Material.Water)) {
      transmute(grid, x, y, Material.Mud, born);
      return true;
    }
    return false;
  }
  if (material === Material.Salt) {
    if (hasNeighbor(grid, x, y, Material.Ash)) {
      transmute(grid, x, y, Material.Powder, born);
      return true;
    }
    if (wetNeighbor(grid, x, y)) {
      transmute(grid, x, y, Material.Brine, born);
      return true;
    }
    return false;
  }
  if (material === Material.Steam) {
    if (hasNeighbor(grid, x, y, Material.Ice)) {
      transmute(grid, x, y, Material.Water, born);
      return true;
    }
    if (hasNeighbor(grid, x, y, Material.Crystal)) {
      transmute(grid, x, y, Material.Aether, born);
      return true;
    }
    return false;
  }
  if (material === Material.Acid) {
    return cookAcid(grid, x, y, born);
  }
  if (material === Material.Lead) {
    if (hasNeighbor(grid, x, y, Material.Azoth) || hasNeighbor(grid, x, y, Material.Acid)) {
      transmute(
        grid,
        x,
        y,
        hasNeighbor(grid, x, y, Material.Azoth) ? Material.Gold : Material.Mercury,
        born,
      );
      return true;
    }
    return false;
  }
  if (material === Material.Mercury) {
    if (hasNeighbor(grid, x, y, Material.Lead) && hasNeighbor(grid, x, y, Material.Fire)) {
      for (const [dx, dy] of N8) {
        const nx = x + dx;
        const ny = y + dy;
        if (grid.get(nx, ny) === Material.Lead) {
          transmute(grid, nx, ny, Material.Gold, born);
          return false;
        }
      }
    }
    return false;
  }
  if (material === Material.Aether) {
    if (strikeRod(grid, x, y, born)) return true;
    if (hasNeighbor(grid, x, y, Material.Gold) && hasNeighbor(grid, x, y, Material.Crystal)) {
      transmute(grid, x, y, Material.Azoth, born);
      return true;
    }
    return false;
  }
  if (material === Material.Oil) {
    if (hasNeighbor(grid, x, y, Material.Powder)) {
      transmute(grid, x, y, Material.Nitro, born);
      return true;
    }
    return false;
  }
  if (material === Material.Tnt || material === Material.Nitro) {
    if (
      hasNeighbor(grid, x, y, Material.Fire) ||
      hasNeighbor(grid, x, y, Material.Ember) ||
      hasNeighbor(grid, x, y, Material.Lava)
    ) {
      detonate(grid, x, y, material === Material.Nitro ? 6 : 4, born);
      return true;
    }
    return false;
  }
  if (material === Material.Rift) {
    riftPull(grid, x, y, born);
    return false;
  }
  if (material === Material.Sand) {
    if (grid.get(x, y + 1) === Material.Brine) {
      transmute(grid, x, y, Material.Stone, born);
      return true;
    }
    return false;
  }
  if (material === Material.Crystal) {
    if (
      grid.get(x, y + 1) === Material.Air &&
      (hasNeighbor(grid, x, y, Material.Water) || hasNeighbor(grid, x, y, Material.Ice)) &&
      randInt(6) === 0
    ) {
      transmute(grid, x, y + 1, Material.Water, born);
    }
    return false;
  }
  if (material === Material.Azoth) {
    for (const [dx, dy] of N8) {
      const nx = x + dx;
      const ny = y + dy;
      if (grid.get(nx, ny) === Material.Lead) transmute(grid, nx, ny, Material.Gold, born);
    }
    return false;
  }
  if (material === Material.Void) {
    devour(grid, x, y, born);
    return false;
  }
  if (material === Material.Ice) {
    freezeWater(grid, x, y, born);
    return false;
  }
  if (material === Material.Plant) {
    growPlant(grid, x, y, born);
    return false;
  }
  if (material === Material.Moss) {
    creepMoss(grid, x, y, born);
    return false;
  }
  if (material === Material.Fire) {
    if (obsidianBox(grid, x, y)) {
      transmute(grid, x, y, Material.Void, born);
      return true;
    }
    if (tryLightPortal(grid, x, y, born)) return true;
    burn(grid, x, y, born);
    return true;
  }
  if (material === Material.Lava) {
    return cookLava(grid, x, y, born);
  }
  if (material === Material.Ember) {
    if (wetNeighbor(grid, x, y)) {
      transmute(grid, x, y, Material.Steam, born);
      return true;
    }
    const fueled = smolderEmber(grid, x, y, born);
    const moved = tryDownAndDiags(grid, x, y, born);
    if (!moved && !fueled) transmute(grid, x, y, Material.Ash, born);
    return true;
  }
  return false;
}

function process(grid: Grid, x: number, y: number, dir: 1 | -1, born: Uint8Array): number {
  if (born[grid.index(x, y)]) return 0;
  const material = grid.get(x, y);
  if (material === Material.Air) return 0;
  if (react(grid, x, y, material, born)) return 0;

  const now = grid.get(x, y);
  const kind = MATERIALS[now].kind;
  if (kind === 'powder') {
    tryDownAndDiags(grid, x, y, born);
    return 0;
  }
  if (kind === 'liquid') return tryLiquid(grid, x, y, dir, born);
  if (kind === 'gas') return tryGas(grid, x, y, dir, born);
  return 0;
}

function bornBuffer(length: number): Uint8Array {
  if (!bornBuf || bornBuf.length !== length) bornBuf = new Uint8Array(length);
  else bornBuf.fill(0);
  return bornBuf;
}

/**
 * One simulation tick: powders, liquids, gases, growth, fire, and transmutations.
 * Horizontal scan flips each frame.
 */
export function step(grid: Grid): void {
  const dir = scanDir;
  scanDir = scanDir === 1 ? -1 : 1;
  const born = bornBuffer(grid.cells.length);

  for (let y = grid.height - 1; y >= 0; y--) {
    if (dir === 1) {
      for (let x = 0; x < grid.width; x++) {
        x += process(grid, x, y, dir, born);
      }
    } else {
      for (let x = grid.width - 1; x >= 0; x--) {
        x += process(grid, x, y, dir, born);
      }
    }
  }
}
