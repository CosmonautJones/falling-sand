import { Grid } from './grid';
import {
  HEAT_AMBIENT,
  HEAT_CONDUCT,
  HEAT_SOURCE,
  Material,
  MATERIALS,
  SHADE_RANGE,
  type MaterialId,
} from './materials';
import { randInt, randShade } from './rng';

let scanDir: 1 | -1 = 1;
let bornBuf: Uint8Array | null = null;
let heatBuf: Uint8Array | null = null;
let blastKick = 0;

const CONDUCT = new Uint8Array(256);
const AMBIENT = new Uint8Array(256);
const SOURCE = new Uint8Array(256);
for (const id of Object.values(Material)) {
  CONDUCT[id] = HEAT_CONDUCT[id];
  AMBIENT[id] = HEAT_AMBIENT[id];
  SOURCE[id] = HEAT_SOURCE[id];
}

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

function isCritter(n: MaterialId): boolean {
  return n === Material.Mite || n === Material.Minnow;
}

function trySwap(grid: Grid, x: number, y: number, nx: number, ny: number): boolean {
  const dst = grid.get(nx, ny);
  if (isCritter(dst)) return false;
  if (!MATERIALS[dst].movable) return false;
  if (!heavier(grid.get(x, y), dst)) return false;
  grid.swap(x, y, nx, ny);
  return true;
}

/** Rise into a denser movable cell (steam through air or water). */
function trySwapUp(grid: Grid, x: number, y: number, nx: number, ny: number): boolean {
  const dst = grid.get(nx, ny);
  if (isCritter(dst)) return false;
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
  const i = grid.index(x, y);
  let dest = into;
  if (grid.cells[i] === Material.Mite && grid.shades[i] >= 64 && dest !== Material.Gold) {
    const air = gatherAir(grid, x, y);
    if (air.length > 0) {
      const [ax, ay] = air[randInt(air.length)];
      transmute(grid, ax, ay, Material.Gold, born);
    } else {
      dest = Material.Gold;
    }
  }
  const prev = grid.heat[i];
  grid.set(x, y, dest, randShade(SHADE_RANGE[dest]));
  const kept = prev > 20 ? prev - 20 : prev;
  if (kept > grid.heat[i]) grid.heat[i] = kept;
  born[i] = 1;
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
  if (wet && plants >= 2 && air.length > 0) {
    const roll = randInt(6);
    if (roll === 0) {
      const [nx, ny] = air[randInt(air.length)];
      transmute(grid, nx, ny, Material.Seed, born);
      return;
    }
    if (roll === 1) {
      const [nx, ny] = air[randInt(air.length)];
      transmute(grid, nx, ny, Material.Bloom, born);
      return;
    }
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
  if (n === Material.Plant || n === Material.Oil || n === Material.Seed || n === Material.Bloom) {
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
    if (
      n === Material.Plant ||
      n === Material.Wood ||
      n === Material.Seed ||
      n === Material.Oil ||
      n === Material.Bloom
    ) {
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
    if (
      n === Material.Plant ||
      n === Material.Wood ||
      n === Material.Moss ||
      n === Material.Mud ||
      n === Material.Bloom ||
      n === Material.Mite ||
      n === Material.Minnow
    ) {
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
      n === Material.Brick ||
      n === Material.Pearl
    ) {
      continue;
    }
    const life =
      n === Material.Plant ||
      n === Material.Wood ||
      n === Material.Seed ||
      n === Material.Moss ||
      n === Material.Bloom ||
      n === Material.Mite ||
      n === Material.Minnow;
    transmute(
      grid,
      nx,
      ny,
      life && !hasNeighbor(grid, x, y, Material.Azoth) ? Material.Void : Material.Air,
      born,
    );
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
      n === Material.Brick ||
      n === Material.Pearl
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
    if (grid.get(nx, ny) !== Material.Water) continue;
    if (grid.heat[grid.index(nx, ny)] >= 40) continue;
    if (randInt(6) === 0) transmute(grid, nx, ny, Material.Ice, born);
  }
}

const CARRY_SHADE = 90;

function isCarrying(grid: Grid, x: number, y: number): boolean {
  return grid.getShade(x, y) >= 64;
}

function isHeat(n: MaterialId): boolean {
  return n === Material.Fire || n === Material.Lava || n === Material.Ember || n === Material.Acid;
}

function isForage(n: MaterialId): boolean {
  return n === Material.Plant || n === Material.Bloom || n === Material.Moss;
}

function forageRank(n: MaterialId): number {
  if (n === Material.Bloom) return 3;
  if (n === Material.Plant) return 2;
  if (n === Material.Moss) return 1;
  return 0;
}

function gatherAir(grid: Grid, x: number, y: number): Array<[number, number]> {
  const air: Array<[number, number]> = [];
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (grid.inBounds(nx, ny) && grid.get(nx, ny) === Material.Air) air.push([nx, ny]);
  }
  return air;
}

function tryCritterStep(
  grid: Grid,
  x: number,
  y: number,
  nx: number,
  ny: number,
  born: Uint8Array,
): boolean {
  if (!grid.inBounds(nx, ny)) return false;
  const dst = grid.get(nx, ny);
  if (
    dst !== Material.Air &&
    dst !== Material.Sand &&
    dst !== Material.Water &&
    dst !== Material.Ash &&
    dst !== Material.Brine
  ) {
    return false;
  }
  grid.swap(x, y, nx, ny);
  markBorn(grid, born, nx, ny);
  return true;
}

function miteDestScore(
  grid: Grid,
  fromX: number,
  fromY: number,
  nx: number,
  ny: number,
  carrying: boolean,
): number {
  const dest = grid.get(nx, ny);
  const wet = dest === Material.Water || dest === Material.Brine;
  let s = dest === Material.Air ? 2 : dest === Material.Sand ? 4 : 0;
  if (wet) s -= 8;
  const from = grid.get(fromX, fromY);
  if (from === Material.Water || from === Material.Brine) {
    if (dest === Material.Sand || dest === Material.Mud) s += 14;
    if (dest === Material.Air) s += 10;
  }
  const under = grid.get(nx, ny + 1);
  if (
    under !== Material.Air &&
    under !== Material.Steam &&
    under !== Material.Aether &&
    under !== Material.Fire
  ) {
    s += 4;
  }
  for (const [dx, dy] of N8) {
    const n = grid.get(nx + dx, ny + dy);
    if (n === Material.Bloom) s += 12;
    else if (isForage(n)) s += 8;
    if (n === Material.Gold && carrying) s += 6;
    if (isHeat(n)) s -= 14;
    if (n === Material.Minnow) s -= 10;
  }
  return s;
}

function pickBest(scored: Array<[number, number, number]>): [number, number] | null {
  if (scored.length === 0) return null;
  let best = scored[0][2];
  for (const row of scored) if (row[2] > best) best = row[2];
  const ties = scored.filter((row) => row[2] === best);
  const [nx, ny] = ties[randInt(ties.length)];
  return [nx, ny];
}

function miteWalk(grid: Grid, x: number, y: number, born: Uint8Array, carrying: boolean): boolean {
  const scored: Array<[number, number, number]> = [];
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (!grid.inBounds(nx, ny)) continue;
    const dst = grid.get(nx, ny);
    if (
      dst !== Material.Air &&
      dst !== Material.Sand &&
      dst !== Material.Water &&
      dst !== Material.Ash &&
      dst !== Material.Brine
    ) {
      continue;
    }
    scored.push([nx, ny, miteDestScore(grid, x, y, nx, ny, carrying)]);
  }
  const dest = pickBest(scored);
  if (!dest) return false;
  return tryCritterStep(grid, x, y, dest[0], dest[1], born);
}

function dropHoard(grid: Grid, x: number, y: number, born: Uint8Array): boolean {
  const scored: Array<[number, number, number]> = [];
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (!grid.inBounds(nx, ny)) continue;
    if (grid.get(nx, ny) !== Material.Air) continue;
    scored.push([nx, ny, hasNeighbor(grid, nx, ny, Material.Gold) ? 2 : 0]);
  }
  const dest = pickBest(scored);
  if (!dest) return false;
  transmute(grid, dest[0], dest[1], Material.Gold, born);
  grid.set(x, y, Material.Mite, randShade(SHADE_RANGE[Material.Mite]));
  return true;
}

function miteAct(grid: Grid, x: number, y: number, born: Uint8Array): boolean {
  let heat = false;
  let food: [number, number] | null = null;
  let foodRank = 0;
  let gold: [number, number] | null = null;
  let kin = false;
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (!grid.inBounds(nx, ny)) continue;
    const n = grid.get(nx, ny);
    if (isHeat(n)) heat = true;
    const rank = forageRank(n);
    if (rank > foodRank) {
      foodRank = rank;
      food = [nx, ny];
    }
    if (n === Material.Gold && !gold) gold = [nx, ny];
    if (n === Material.Mite) kin = true;
  }

  if (heat) {
    if (miteWalk(grid, x, y, born, isCarrying(grid, x, y))) return true;
    transmute(grid, x, y, Material.Ash, born);
    return true;
  }

  if (food) {
    transmute(grid, food[0], food[1], Material.Air, born);
    const air = gatherAir(grid, x, y);
    if (kin && air.length > 0 && randInt(5) === 0) {
      const [nx, ny] = air[randInt(air.length)];
      transmute(grid, nx, ny, Material.Mite, born);
    }
    return true;
  }

  const carrying = isCarrying(grid, x, y);
  if (carrying && gold && dropHoard(grid, x, y, born)) return true;
  if (!carrying && gold) {
    transmute(grid, gold[0], gold[1], Material.Air, born);
    grid.set(x, y, Material.Mite, CARRY_SHADE);
    return true;
  }

  const below = grid.get(x, y + 1);
  const hanging =
    below === Material.Air ||
    below === Material.Steam ||
    below === Material.Fire ||
    below === Material.Aether;
  if (hanging) {
    let cling = false;
    for (const [dx, dy] of N8) {
      const nx = x + dx;
      const ny = y + dy;
      if (!grid.inBounds(nx, ny)) continue;
      const n = grid.get(nx, ny);
      if (
        n === Material.Sand ||
        n === Material.Stone ||
        n === Material.Wood ||
        n === Material.Glass ||
        n === Material.Mud ||
        n === Material.Plant ||
        n === Material.Bloom ||
        n === Material.Gold ||
        n === Material.Pearl ||
        n === Material.Brick ||
        n === Material.Obsidian ||
        n === Material.Ice ||
        n === Material.Moss
      ) {
        cling = true;
        break;
      }
    }
    if (!cling) return false;
  }

  if (randInt(3) !== 0) return true;
  miteWalk(grid, x, y, born, carrying);
  return true;
}

function minnowScore(grid: Grid, nx: number, ny: number): number {
  let s = 0;
  const t = grid.getHeat(nx, ny);
  if (t > 40) s -= t >> 2;
  if (ny > 0 && grid.get(nx, ny - 1) === Material.Air) s += 2;
  for (const [dx, dy] of N8) {
    const n = grid.get(nx + dx, ny + dy);
    if (n === Material.Minnow) s += 5;
    if (n === Material.Mite) s += 3;
    if (n === Material.Seed) s += 4;
    if (n === Material.Crystal) s += 2;
    if (n === Material.Pearl) s += 1;
    if (
      n === Material.Oil ||
      n === Material.Lava ||
      n === Material.Fire ||
      n === Material.Acid ||
      n === Material.Nitro
    ) {
      s -= 20;
    }
  }
  return s;
}

function minnowAct(grid: Grid, x: number, y: number, born: Uint8Array): boolean {
  let hurt = false;
  let mite: [number, number] | null = null;
  let seed: [number, number] | null = null;
  let crystal = false;
  let kin = false;
  const water: Array<[number, number]> = [];
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (!grid.inBounds(nx, ny)) continue;
    const n = grid.get(nx, ny);
    if (
      n === Material.Oil ||
      n === Material.Lava ||
      n === Material.Fire ||
      n === Material.Acid ||
      n === Material.Nitro
    ) {
      hurt = true;
    }
    if (n === Material.Mite && !mite) mite = [nx, ny];
    if (n === Material.Seed && !seed) seed = [nx, ny];
    if (n === Material.Crystal) crystal = true;
    if (n === Material.Minnow) kin = true;
    if (n === Material.Water || n === Material.Brine) water.push([nx, ny]);
  }

  if (hurt) {
    transmute(grid, x, y, Material.Ash, born);
    return true;
  }
  if (mite) {
    transmute(grid, mite[0], mite[1], Material.Water, born);
    return true;
  }
  if (seed) {
    transmute(grid, seed[0], seed[1], Material.Water, born);
    return true;
  }
  if (crystal && randInt(6) === 0) {
    const air = gatherAir(grid, x, y);
    if (air.length > 0) {
      const [nx, ny] = air[randInt(air.length)];
      transmute(grid, nx, ny, Material.Pearl, born);
      return true;
    }
    if (water.length > 0) {
      const [nx, ny] = water[randInt(water.length)];
      transmute(grid, nx, ny, Material.Pearl, born);
      return true;
    }
  }
  if (water.length === 0) {
    return kin;
  }

  const scored = water.map(
    ([nx, ny]) => [nx, ny, minnowScore(grid, nx, ny)] as [number, number, number],
  );
  const dest = pickBest(scored);
  if (!dest) return true;
  grid.swap(x, y, dest[0], dest[1]);
  markBorn(grid, born, dest[0], dest[1]);
  return true;
}

function hatchMite(grid: Grid, x: number, y: number, born: Uint8Array): void {
  if (!hasNeighbor(grid, x, y, Material.Plant) && !hasNeighbor(grid, x, y, Material.Bloom)) return;
  if (!hasNeighbor(grid, x, y, Material.Water) && !hasNeighbor(grid, x, y, Material.Brine)) return;
  if (randInt(8) !== 0) return;
  const air = gatherAir(grid, x, y);
  if (air.length === 0) return;
  const [nx, ny] = air[randInt(air.length)];
  transmute(grid, nx, ny, Material.Mite, born);
}

function dewSteam(grid: Grid, x: number, y: number): boolean {
  const above = y === 0 ? Material.Stone : grid.get(x, y - 1);
  const blocked = y === 0 || !MATERIALS[above].movable;
  return blocked && hasNeighbor(grid, x, y, Material.Steam);
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
    if (dewSteam(grid, x, y)) {
      transmute(grid, x, y, Material.Water, born);
      return true;
    }
    return false;
  }
  if (material === Material.Mite) {
    return miteAct(grid, x, y, born);
  }
  if (material === Material.Minnow) {
    return minnowAct(grid, x, y, born);
  }
  if (material === Material.Mud) {
    hatchMite(grid, x, y, born);
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
    const fueled = smolderEmber(grid, x, y, born);
    if (wetNeighbor(grid, x, y)) {
      transmute(grid, x, y, Material.Steam, born);
      return true;
    }
    const moved = tryDownAndDiags(grid, x, y, born);
    if (!moved && !fueled) transmute(grid, x, y, Material.Ash, born);
    return true;
  }
  return false;
}

function heatScratch(length: number): Uint8Array {
  if (!heatBuf || heatBuf.length !== length) heatBuf = new Uint8Array(length);
  return heatBuf;
}

/**
 * One explicit Euler sweep of
 *   T' = T + (α/32) ∇²T + (λ/256)(T∞ − T)
 * Integer-only, ping-pong scratch. α is capped at 8 so 1 − α/8 ≥ 0 (CFL).
 */
function thermals(grid: Grid, born: Uint8Array): void {
  const { cells, heat, width: w, height: h } = grid;
  const n = cells.length;
  for (let i = 0; i < n; i++) {
    const src = SOURCE[cells[i]];
    if (src > heat[i]) heat[i] = src;
  }

  // Advection before diffusion (operator split): hot liquid rises while it still holds heat.
  for (let y = h - 1; y >= 1; y--) {
    for (let x = 0; x < w; x++) {
      if (born[y * w + x]) continue;
      tryBuoyancy(grid, x, y, born);
    }
  }

  const out = heatScratch(n);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const t = heat[i];
      const up = y > 0 ? heat[i - w] : t;
      const dn = y < h - 1 ? heat[i + w] : t;
      const rt = x < w - 1 ? heat[i + 1] : t;
      const lf = x > 0 ? heat[i - 1] : t;
      const lap = up + dn + rt + lf - (t << 2);
      let next = t + ((CONDUCT[cells[i]] * lap) >> 5);
      const mat = cells[i];
      const leak = mat === Material.Air || mat === Material.Steam ? 10 : 2;
      next += ((AMBIENT[mat] - next) * leak) >> 8;
      out[i] = next < 0 ? 0 : next > 255 ? 255 : next;
    }
  }
  heat.set(out);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      if (born[i]) continue;
      const mat = cells[i];
      const t = heat[i];
      if (mat === Material.Ice && t >= 72) {
        transmute(grid, x, y, Material.Water, born);
      }
    }
  }
}

function tryBuoyancy(grid: Grid, x: number, y: number, born: Uint8Array): boolean {
  if (y === 0) return false;
  const mat = grid.get(x, y);
  if (SOURCE[mat] > 0) return false;
  if (grid.get(x, y - 1) !== mat) return false;
  if (grid.getHeat(x, y) < grid.getHeat(x, y - 1) + 24) return false;
  grid.swap(x, y, x, y - 1);
  markBorn(grid, born, x, y - 1);
  return true;
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
  thermals(grid, born);

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
