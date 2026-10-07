import { createRandomStreams } from './random.js';
import { validateWorldState, validateCommands, validateOperations, validateCheckpointSize } from './checkpoint.js';

// Alembic engine v2 — port of CosmonautJones/falling-sand sim, plus per-grain velocity, liquid dispersion,
// a coarse convection field, storms, visitors, tools, wipes, and snapshots.
// Simulation instances used by the worker/main-thread adapter in alembic-engine-v2.js.

export const W = 480, H = 270, N = W * H;
export const AIR=0,SAND=1,WATER=2,STONE=3,FIRE=4,PLANT=5,OIL=6,SEED=7,ASH=8,MUD=9,GLASS=10,MOSS=11,ICE=12,WOOD=13,SALT=14,STEAM=15,LAVA=16,EMBER=17,OBSIDIAN=18,BRINE=19,CRYSTAL=20,ACID=21,LEAD=22,MERCURY=23,GOLD=24,AETHER=25,AZOTH=26,VOID=27,POWDER=28,BRICK=29,RIFT=30,TNT=31,NITRO=32,MITE=33,MINNOW=34,BLOOM=35,PEARL=36,SMOKE=37,PLASMA=38,CLOUD=39,VISITOR=40,ICHOR=41,RELIC=42;
export const COUNT = 43;

export const NAMES = ['air','sand','water','stone','fire','plant','oil','seed','ash','mud','glass','moss','ice','wood','salt','steam','lava','ember','obsidian','brine','crystal','acid','lead','mercury','gold','aether','azoth','void','powder','brick','rift','tnt','nitro','mite','minnow','bloom','pearl','smoke','plasma','cloud','visitor','ichor','relic'];
export const COLORS = [[14,14,20],[214,176,96],[58,122,214],[110,110,118],[255,84,28],[42,158,68],[138,72,24],[186,142,48],[168,168,172],[92,64,40],[148,206,196],[28,92,48],[176,214,232],[118,78,42],[236,232,224],[198,206,214],[255,106,12],[220,64,32],[28,24,36],[36,148,168],[186,154,220],[156,214,48],[86,90,98],[176,186,196],[232,178,48],[120,220,255],[218,88,168],[8,0,18],[48,42,38],[176,92,64],[92,44,148],[196,52,44],[72,160,64],[196,152,78],[74,186,198],[236,64,112],[210,198,178],[74,68,66],[214,232,255],[150,156,172],[120,255,150],[96,236,128],[64,196,186]];
const DENS = Uint8Array.from([10,160,100,255,3,40,70,130,45,170,255,30,255,255,150,2,205,18,255,118,255,108,195,188,220,1,255,40,85,255,255,255,95,52,88,35,255,4,3,0,50,104,230]);
const MOV = Uint8Array.from([1,1,1,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,1,0,1,1,1,1,1,0,1,1,0,0,0,1,1,1,0,0,1,0,1,1,1,1]);
const K_STATIC=0, K_POWDER=1, K_LIQUID=2, K_GAS=3;
const KIND = Uint8Array.from([0,1,2,0,0,0,2,1,1,1,0,0,0,0,1,3,2,1,0,2,0,2,1,2,1,3,0,1,1,0,0,0,2,1,1,0,0,3,0,3,0,2,1]);
const SHADE = Uint8Array.from([0,18,14,5,22,12,16,14,12,14,10,10,10,12,16,18,20,18,6,12,14,14,8,16,18,20,22,4,10,8,16,10,14,16,14,12,10,10,10,14,10,12,10]);
const DISP = new Uint8Array(64);
Object.entries({[WATER]:8,[BRINE]:6,[ACID]:6,[OIL]:3,[MERCURY]:3,[NITRO]:3,[LAVA]:1,[ICHOR]:3}).forEach(([k,v])=>DISP[k]=v);
// Feel tables: FRIC = chance a powder refuses a diagonal slide (>=0.5 also needs a 2-deep drop, so piles stand steeper); VISC = chance a liquid refuses to flow sideways/diagonally this tick.
const FRIC = new Float32Array(64), VISC = new Float32Array(64);
Object.entries({[ASH]:0.6,[MUD]:0.7,[SALT]:0.3}).forEach(([k,v])=>FRIC[k]=v);
Object.entries({[LAVA]:0.8,[OIL]:0.4,[MERCURY]:0.3,[NITRO]:0.3,[ICHOR]:0.5}).forEach(([k,v])=>VISC[k]=v);
const CR = new Int16Array(64), CG = new Int16Array(64), CB = new Int16Array(64);
COLORS.forEach((c, i) => { CR[i] = c[0]; CG[i] = c[1]; CB[i] = c[2]; });

export const STARTER = [SAND,WATER,STONE,SEED,OIL,FIRE,AIR,ICE,WOOD,SALT,LAVA,ACID,LEAD,TNT];
export const TRANSMUTED = [PLANT,ASH,MUD,GLASS,MOSS,STEAM,SMOKE,EMBER,OBSIDIAN,BRINE,CRYSTAL,MERCURY,GOLD,AETHER,AZOTH,VOID,POWDER,BRICK,RIFT,NITRO,MITE,MINNOW,BLOOM,PEARL,CLOUD,PLASMA,VISITOR,ICHOR,RELIC];
export const BRUSH_SIZES = [1, 3, 6, 12, 22];

const AMBIENT = new Uint8Array(256).fill(18), CONDUCT = new Uint8Array(256).fill(4), SOURCE = new Uint8Array(256), SEEDHEAT = new Uint8Array(256);
Object.entries({[ICE]:3,[WATER]:34,[BRINE]:32,[STEAM]:88,[FIRE]:220,[LAVA]:255,[EMBER]:200,[OIL]:22,[ACID]:28,[MERCURY]:24,[NITRO]:26,[AETHER]:40,[OBSIDIAN]:14,[GLASS]:16,[CRYSTAL]:12,[SMOKE]:40,[CLOUD]:16,[PLASMA]:255}).forEach(([k,v])=>AMBIENT[k]=v);
Object.entries({[AIR]:7,[STEAM]:7,[AETHER]:7,[SMOKE]:7,[CLOUD]:7,[WATER]:6,[BRINE]:6,[ACID]:6,[MERCURY]:8,[GOLD]:8,[LEAD]:8,[RELIC]:8,[ICE]:5,[GLASS]:2,[WOOD]:2,[PLANT]:3,[BLOOM]:3,[MOSS]:3,[OBSIDIAN]:1,[FIRE]:6,[LAVA]:6,[EMBER]:6,[PLASMA]:6}).forEach(([k,v])=>CONDUCT[k]=v);
Object.entries({[FIRE]:220,[LAVA]:255,[EMBER]:200,[STEAM]:90,[PLASMA]:255}).forEach(([k,v])=>SOURCE[k]=v);
for (let i = 0; i < 256; i++) SEEDHEAT[i] = SOURCE[i] > 0 ? SOURCE[i] : AMBIENT[i];

// Renderer LUT: R liquid (255 clear, 128 opaque), G bevel (255 powder, 128 solid), B glassy, A gas.
export const LUT = new Uint8Array(64 * 4);
for (const m of [WATER, BRINE, ACID, ICHOR]) LUT[m*4] = 255;
for (const m of [OIL, LAVA, MERCURY, NITRO]) LUT[m*4] = 128;
for (const m of [SAND, SEED, ASH, MUD, SALT, EMBER, LEAD, GOLD, POWDER, MITE, RELIC]) LUT[m*4+1] = 255;
for (const m of [STONE, PLANT, MOSS, WOOD, OBSIDIAN, BRICK, TNT, BLOOM, PEARL]) LUT[m*4+1] = 128;
for (const m of [GLASS, CRYSTAL, ICE, AZOTH]) LUT[m*4+2] = 255;
for (const m of [STEAM, AETHER, SMOKE, CLOUD]) LUT[m*4+3] = 255;
const EMF = new Uint8Array(64);
Object.entries({[FIRE]:255,[LAVA]:230,[EMBER]:230,[GOLD]:40,[AETHER]:140,[AZOTH]:150,[RIFT]:170,[BLOOM]:50,[CRYSTAL]:30,[ACID]:25,[STEAM]:12,[MINNOW]:20,[PEARL]:25,[MERCURY]:15,[PLASMA]:255,[VISITOR]:170,[ICHOR]:110,[RELIC]:110}).forEach(([k,v])=>EMF[k]=v);
const NOAO = new Uint8Array(64); for (const m of [FIRE,GLASS,CRYSTAL,STEAM,AETHER,AZOTH,VOID,RIFT,PLASMA,SMOKE,CLOUD]) NOAO[m] = 1;

export const PAGES = [
  {w:'The first emptiness.', l:'Grains fall through it. The vessel is a box of this, and every other reagent is an argument against it.'},
  {w:'The shore in a grain.', l:'Falls, slides, dunes. Fire vitrifies it to glass. Resting on brine, it petrifies. A falling band will splash a pool.'},
  {w:'The wet argument.', l:'Runs, pools, drowns fire as steam. Ice drinks it. Heat soaks; hot water rises. Seeds and ash wait for it.'},
  {w:'The floor that will not move.', l:'Acid prospects it for lead, rarely gold. Fire licks it toward lava. Moss wants it wet. It conducts heat slowly.'},
  {w:'A short life, hungry.', l:'Eats plant, oil, wood, powder, bloom. Without fuel it keeps ash. Water makes steam. Boxed in eight obsidian it becomes a black sun. An obsidian frame lit with it is a door.'},
  {w:'Seed drinks. The garden answers.', l:'Grows while wet. A thicket drops seed, then opens bloom. Ash is bone-meal. Fire takes it. Mites graze it.'},
  {w:'A dark float.', l:'Rides water. Burns. With powder it waits as nitro. Minnows die in it.'},
  {w:'A promise with mass.', l:'Drinks water or mud and stands as plant. Fire eats the unpromised.'},
  {w:'Fire without fuel keeps a grey secret.', l:'Slakes in water as mud. A dry plant still grows if ash is near. With salt it makes a fuse.'},
  {w:'Ash slakes. The floor remembers rain.', l:'Fire remembers it as brick. A seed will sprout on it. Wet, against plant, it hatches mites.'},
  {w:'Sand looks upon fire and learns to see.', l:'It will not fall. Heat crawls through it slowly. Cups are made of this so lava can be kept.'},
  {w:'Wet stone grows a quiet pelt.', l:'Creeps along stone that drinks. Mites will graze it. Acid and fire do not suffer it.'},
  {w:'Water, stopped.', l:'Freezes neighboring water. Fire and ember thaw it; heat soaks through a wall, then it runs. Steam that kisses it falls as water. Crystal hanging beside it drips.'},
  {w:'A standing fuel.', l:'Fire throws ember from it. It will not slide. The opening casks sit by a little of this.'},
  {w:'A white thirst.', l:'Drinks and becomes brine. With ash, a short black fuse. Acid tamed by it is only water again.'},
  {w:'Water climbs as a ghost.', l:'Rises through air and water. Ice knocks it down. Crystal with it forgets to fall and becomes aether. A cloud against the ceiling rains as dew.'},
  {w:'Stone that forgot itself.', l:'A heat that will not go out. Water and ice quench it to obsidian and steam. Sand becomes glass in its sight.'},
  {w:'Wood throws a falling star.', l:'Falls like powder. Melts ice even in a wet pool, then quenches to steam. Without fuel it cools to ash. The ceiling sometimes remembers one.'},
  {w:'Lava and water argue. Night wins.', l:'It holds against blast. Eight around fire make void. A frame of it, inner air at least two by two, lit with fire, is a rift.'},
  {w:'Salt drinks and will not freeze easily.', l:'Heavier water. Sand that settles on it turns to stone. Fire leaves a violet bone: crystal.'},
  {w:'Hot brine keeps a violet bone.', l:'Hanging over air beside ice or water, it drips. Steam that kisses it becomes aether. A minnow that schools against it sometimes leaves a pearl.'},
  {w:'A green bite.', l:'Lead sheds as mercury. Stone yields sand, sometimes lead, rarely gold. Salt tames it. Living stuff it simply erases.'},
  {w:'The heavy king, unripe.', l:'Acid frees mercury. Mercury, lead, and fire roast it to gold. Azoth finishes that roast without the flame.'},
  {w:'Lead sheds its weight. Hermes laughs.', l:'A living silver. Next to lead and fire it crowns the king. The word hermes, typed into the dark, rains it.'},
  {w:'The roast is finished. The king is in the cup.', l:'Heavy powder, a spark in the blit. A column six high, kissed by aether at the tip, strikes fire at the base. Mites will steal a grain and walk the colour of the king. Konami still works.'},
  {w:'Steam kisses crystal and forgets to fall.', l:'Lighter than steam. On gold and crystal it coagulates as azoth. On a gold rod it is lightning. Seven strikes on the name rain it.'},
  {w:'Solve et coagula. The Work is in the vessel.', l:'Gold, aether, and crystal. It turns nearby lead to gold without fire. Void will not eat what stands in its shade. The glass remembers.'},
  {w:'A black sun. It is hungry.', l:'Fire boxed in eight obsidian. It spreads through living stuff as more void. Azoth keeps it back. The word nigredo opens a little of it.'},
  {w:'Salt and ash make a short argument.', l:'A fuse. Fire walks it one hop a tick. Oil that drinks it waits as nitro.'},
  {w:'Mud remembers fire and stands.', l:'It will not fall. Heat crawls. A kiln in miniature.'},
  {w:'A door of night. What falls in forgets its name.', l:'An obsidian frame, inner hole at least two by two, lit with fire. What touches it becomes aether. Gold, crystal, stone, and pearl it will not drink.'},
  {w:'A red cask. Do not sneeze.', l:'Fire, ember, lava, or a burning fuse. Neighbors chain. Sand is thrown. Water boils. Obsidian, azoth, and rifts hold.'},
  {w:'Oil drinks powder and waits for a spark.', l:'A meaner hole than the red cask. Same spark. Same things hold.'},
  {w:'A grain with legs. It steals.', l:'Camouflaged in sand, it crawls, burrows, and will not swim if it can climb out. Bloom before plant before moss. Heat sends it running; if it dies laden, gold or mud spills. Minnows hunt it at the shore. Gold it only hoards beside more gold. Loose mud it will haul, and set down beside kin or more mud; a nest against plant it will not steal. A huddle mills instead of scattering. They lay a scent empty mites shun and laden mites follow home. Wet mud against plant hatches more.'},
  {w:'The trough keeps a silver thought.', l:'Schools, darts the meniscus, and swims off heat. Eats a mite — and any seed — that touches the pool; stolen gold is left behind. Oil, lava, fire, acid cook it to ash. Crystal nearby, it sometimes dreams a pearl.'},
  {w:'The thicket shows its throat.', l:'A wet plant thicket opens this instead of another seed. Mites prefer it. Fire takes it like plant.'},
  {w:'A minnow dreamed of crystal and woke with a moon.', l:'It will not fall. A rift will not drink it. Keep it.'},
  {w:'Fire exhales.', l:'Heavier than steam, lighter than air. The heat carries it in plumes, the draft bends it, and it thins to nothing.'},
  {w:'The sky draws a line.', l:'A bolt lives a few ticks. It fuses sand into glass roots, boils water and everything swimming in it, lights casks, and prefers metal.'},
  {w:'Steam that waited at the ceiling.', l:'When enough steam gathers, the ceiling darkens. Clouds drift on the draft, rain, and strike. The word tempest calls them.'},
  {w:'They came for the gold.', l:'Enough gold in the glass draws a ship. Its crew carries the king away grain by grain. Mites swarm them. Fire, acid, and lightning end them. A blast near the hull brings it down.'},
  {w:'What a visitor leaves behind.', l:'A glowing liquid. Mites drink it and multiply. Fire lifts it as aether.'},
  {w:'A ship fell.', l:'Hull metal that hums. Heavy, warm, and loved by lightning. A rift will not drink it.'},
];
export const HINTS = {
  [PLANT]:'A promise, given water.', [ASH]:'What fire keeps when it starves.', [MUD]:'Grey, slaked.', [GLASS]:'Sand that saw fire.',
  [MOSS]:'Wet stone, patient.', [STEAM]:'Water and fire argue.', [SMOKE]:'Feed a fire well.', [EMBER]:'Burning wood throws something.',
  [OBSIDIAN]:'Lava meets water.', [BRINE]:'Salt drinks.', [CRYSTAL]:'Heat the drink of salt.', [MERCURY]:'Acid and the heavy grey.',
  [GOLD]:'Living silver, lead, and flame.', [AETHER]:'Steam kisses a violet bone.', [AZOTH]:'Gold, aether, crystal, together.',
  [VOID]:'Fire, boxed in night on every side.', [POWDER]:'White thirst meets grey secret.', [BRICK]:'Mud remembers fire.',
  [RIFT]:'A frame of night, lit.', [NITRO]:'A dark float drinks a fuse.', [MITE]:'Look closely at the dune.', [MINNOW]:'Look closely at the trough.',
  [BLOOM]:'A wet thicket opens.', [PEARL]:'A minnow dreams near crystal.', [CLOUD]:'Fill the ceiling with steam.', [PLASMA]:'Wait out a storm.',
  [VISITOR]:'Make a great deal of gold.', [ICHOR]:'Let the mites fight.', [RELIC]:'Bring a ship down.',
};

const DX = [-1,0,1,-1,1,-1,0,1], DY = [-1,-1,-1,0,0,1,1,1];
const CS = 8, CW = 60, CH = 34, CNN = CW * CH;
const G = 0.16, MAXV = 7;
const GOLD_CARRY = 90, MUD_CARRY = -40;
const FLAMMABLE = new Uint8Array(64); for (const m of [PLANT, WOOD, OIL, SEED, BLOOM, POWDER]) FLAMMABLE[m] = 1;
// Restless materials keep their 8x8 chunk awake even when nothing moved: they act on their own
// (fire, critters, growth, decay, random drips) or ride the draft (gases, light powders).
const ALIVE = new Uint8Array(64);
for (const m of [FIRE, EMBER, LAVA, PLANT, MOSS, MUD, SMOKE, STEAM, CLOUD, PLASMA, MITE, MINNOW, VISITOR, ACID, VOID, RIFT, ICE, CRYSTAL, AZOTH, AETHER, ICHOR, ASH]) ALIVE[m] = 1;
const CC = new Uint16Array(CNN);
for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) CC[cy * CW + cx] = 8 * Math.max(1, Math.min(8, H - cy * 8));

export function createWorld({ seed = 0xa341316c, scene = 'vessel' } = {}) {
  let initialSeed = seed >>> 0, initialScene = scene, tickIndex = 0;
  let commands = [];
  let wipe = -1, wipeC = null, wipeS = null;
  // ---------- grid ----------
  const cells = new Uint8Array(N), shades = new Int8Array(N), heat = new Uint8Array(N).fill(18), trails = new Uint8Array(N);
  const VX = new Float32Array(N), VY = new Float32Array(N);
  const born = new Uint8Array(N), heatOut = new Uint8Array(N), trailOut = new Uint8Array(N);
  const meltList = new Int32Array(N);
  // Sleeping chunks: a chunk runs the cell pass if it holds restless material, or if it or a neighbour changed.
  const dirty = new Uint8Array(CNN).fill(1), awake = new Uint8Array(CNN).fill(1), live = new Uint8Array(CNN);
  const markDirty = (x, y) => { dirty[(y >> 3) * CW + (x >> 3)] = 1; };
  // Thermal skip state is derived (recomputed exactly when stale), so it is never checkpointed.
  const tQuiet = new Uint8Array(CNN), tFast = new Uint8Array(CNN), qLive = new Uint8Array(CNN), qSOL = new Uint16Array(CNN), qHS = new Float32Array(CNN);
  let scanDir = 1, blastKick = 0, trailsLive = false;
  const EV = [];
  const ev = e => { if (EV.length < 48) EV.push(e); };

  const random = createRandomStreams(seed);
  const ri = n => random.physical.int(n), rf = () => random.physical.float();
  function rshade(a) { return a <= 0 ? 0 : random.cosmetic.int(a * 2 + 1) - a; }
  // Plasma shade is a lifetime. Cargo shades are assigned explicitly by gameplay.
  function grain(m) { return m === PLASMA ? 3 + ri(3) : rshade(SHADE[m]); }
  function inb(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  function get(x, y) { return (x >= 0 && y >= 0 && x < W && y < H) ? cells[y * W + x] : STONE; }
  function setc(x, y, m, s) { if (!inb(x, y)) return; const i = y * W + x; cells[i] = m; shades[i] = s; heat[i] = SEEDHEAT[m]; VX[i] = 0; VY[i] = 0; markDirty(x, y); }
  function swap(ax, ay, bx, by) {
    if (!inb(ax, ay) || !inb(bx, by)) return;
    markDirty(ax, ay); markDirty(bx, by);
    const a = ay * W + ax, b = by * W + bx;
    let t = cells[a]; cells[a] = cells[b]; cells[b] = t;
    t = shades[a]; shades[a] = shades[b]; shades[b] = t;
    t = heat[a]; heat[a] = heat[b]; heat[b] = t;
    t = VX[a]; VX[a] = VX[b]; VX[b] = t;
    t = VY[a]; VY[a] = VY[b]; VY[b] = t;
  }
  function paint(cx, cy, r, m) {
    const r2 = r * r;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) setc(x, y, m, grain(m));
    }
  }
  function paintLine(x0, y0, x1, y1, r, m) {
    let x = x0, y = y0; const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, guard = 0;
    for (;;) {
      paint(x, y, r, m);
      if ((x === x1 && y === y1) || ++guard > 2000) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
  // Optional pointer-fling: write op.vx/op.vy (clamped) into grains newly painted by the op; pre-existing same-material cells are untouched.
  const PRE = new Uint8Array(W * H);
  function flingPre(x0, y0, x1, y1, m) {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) { const i = y * W + x; PRE[i] = cells[i] === m ? 1 : 0; }
  }
  function flingCells(x0, y0, x1, y1, m, vx, vy) {
    const hasX = typeof vx === 'number' && isFinite(vx), hasY = typeof vy === 'number' && isFinite(vy);
    if ((!hasX && !hasY) || m === AIR || KIND[m] === K_STATIC || isCritter(m)) return;
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const i = y * W + x; if (cells[i] !== m || PRE[i]) continue;
      if (hasX) VX[i] = Math.max(-MAXV, Math.min(MAXV, vx));
      if (hasY) VY[i] = Math.max(-MAXV, Math.min(MAXV, vy));
    }
  }
  function fill(x0, y0, x1, y1, m) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setc(x, y, m, grain(m)); }
  function clearGrid() { dirty.fill(1); tQuiet.fill(0); cells.fill(AIR); shades.fill(0); heat.fill(AMBIENT[AIR]); trails.fill(0); VX.fill(0); VY.fill(0); trailsLive = false; }

  // ---------- convection field (coarse stable-fluids lite) ----------
  const WU = new Float32Array(CNN), WV = new Float32Array(CNN), WU0 = new Float32Array(CNN), WV0 = new Float32Array(CNN);
  const WP = new Float32Array(CNN), WP2 = new Float32Array(CNN), WD = new Float32Array(CNN), HS = new Float32Array(CNN), SOL = new Uint16Array(CNN), WS = new Uint8Array(CNN);
  let windEnergy = 0;
  function sampleField(F, px, py) {
    px = Math.max(0, Math.min(CW - 1.001, px)); py = Math.max(0, Math.min(CH - 1.001, py));
    const x0 = px | 0, y0 = py | 0, fx = px - x0, fy = py - y0, i = y0 * CW + x0;
    return (F[i] * (1 - fx) + F[i + 1] * fx) * (1 - fy) + (F[i + CW] * (1 - fx) + F[i + CW + 1] * fx) * fy;
  }
  function windStep() {
    for (let c = 0; c < CNN; c++) {
      WS[c] = SOL[c] / CC[c] > 0.55 ? 1 : 0;
      if (WS[c]) { WU[c] = 0; WV[c] = 0; continue; }
      const avg = HS[c] / CC[c];
      WV[c] -= (avg - 22) * 0.0014;
    }
    WU0.set(WU); WV0.set(WV);
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
      const c = cy * CW + cx; if (WS[c]) continue;
      const px = cx - WU0[c] / CS, py = cy - WV0[c] / CS;
      WU[c] = sampleField(WU0, px, py) * 0.985;
      WV[c] = sampleField(WV0, px, py) * 0.985;
    }
    const at = (F, cx, cy, c) => (cx < 0 || cy < 0 || cx >= CW || cy >= CH) ? 0 : (WS[cy * CW + cx] ? 0 : F[cy * CW + cx]);
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
      const c = cy * CW + cx;
      WD[c] = -0.5 * (at(WU, cx + 1, cy) - at(WU, cx - 1, cy) + at(WV, cx, cy + 1) - at(WV, cx, cy - 1));
      WP[c] = 0;
    }
    let A = WP, B = WP2;
    for (let it = 0; it < 14; it++) {
      for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
        const c = cy * CW + cx;
        const pl = cx > 0 && !WS[c - 1] ? A[c - 1] : A[c], pr = cx < CW - 1 && !WS[c + 1] ? A[c + 1] : A[c];
        const pu = cy > 0 && !WS[c - CW] ? A[c - CW] : A[c], pd = cy < CH - 1 && !WS[c + CW] ? A[c + CW] : A[c];
        B[c] = (pl + pr + pu + pd + WD[c]) * 0.25;
      }
      const t = A; A = B; B = t;
    }
    let e = 0;
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
      const c = cy * CW + cx; if (WS[c]) continue;
      const pl = cx > 0 ? A[c - 1] : A[c], pr = cx < CW - 1 ? A[c + 1] : A[c], pu = cy > 0 ? A[c - CW] : A[c], pd = cy < CH - 1 ? A[c + CW] : A[c];
      let u = WU[c] - 0.5 * (pr - pl), v = WV[c] - 0.5 * (pd - pu);
      if (cx === 0 || cx === CW - 1) u = 0;
      if (cy === 0 || cy === CH - 1) v = 0;
      u = u > 3 ? 3 : u < -3 ? -3 : u; v = v > 3 ? 3 : v < -3 ? -3 : v;
      WU[c] = u; WV[c] = v; e += Math.abs(u) + Math.abs(v);
    }
    windEnergy = e;
  }
  const windC = (x, y) => (y >> 3) * CW + (x >> 3);

  // ---------- motion ----------
  const isCritter = n => n === MITE || n === MINNOW || n === VISITOR;
  function canMove(sx, sy, nx, ny) {
    if (!inb(nx, ny)) return false;
    const d = cells[ny * W + nx];
    if (d === MITE || d === MINNOW || d === VISITOR || !MOV[d]) return false;
    return DENS[cells[sy * W + sx]] > DENS[d];
  }
  function trySwap(x, y, nx, ny) {
    const dst = get(nx, ny);
    if (isCritter(dst) || !MOV[dst]) return false;
    const gap = DENS[get(x, y)] - DENS[dst];
    if (gap <= 0) return false;
    if (KIND[dst] === K_LIQUID && KIND[get(x, y)] === K_LIQUID && rf() * 50 >= Math.max(gap, 3)) return false;
    swap(x, y, nx, ny); return true;
  }
  function trySwapUp(x, y, nx, ny) {
    const dst = get(nx, ny);
    if (isCritter(dst) || !MOV[dst]) return false;
    if (DENS[get(x, y)] >= DENS[dst]) return false;
    swap(x, y, nx, ny); return true;
  }
  function markBorn(x, y) { if (inb(x, y)) born[y * W + x] = 1; }
  function splashUp(x, y) {
    if (KIND[get(x, y)] !== K_LIQUID) return;
    if (trySwap(x, y, x, y - 1)) { markBorn(x, y - 1); return; }
    const s = ri(2) === 0 ? -1 : 1;
    if (trySwap(x, y, x + s, y - 1)) { markBorn(x + s, y - 1); return; }
    if (trySwap(x, y, x - s, y - 1)) markBorn(x - s, y - 1);
  }
  function tryDownAndDiags(x, y) {
    const below = get(x, y + 1);
    if (trySwap(x, y, x, y + 1)) { if (KIND[below] === K_LIQUID) splashUp(x, y); return true; }
    const f = ri(2) === 0 ? -1 : 1;
    if (trySwap(x, y, x + f, y + 1)) return true;
    if (trySwap(x, y, x - f, y + 1)) return true;
    return false;
  }
  // Ray-step a grain along its velocity; displaces lighter movables, scatters on impact.
  function ballistic(x, y, vx, vy, liq) {
    const steps = Math.min(8, Math.ceil(Math.max(Math.abs(vx), Math.abs(vy))));
    if (steps <= 0) return false;
    const sx = vx / steps, sy = vy / steps;
    let fx = x + 0.5, fy = y + 0.5, cx = x, cy = y, moved = false;
    for (let s = 0; s < steps; s++) {
      fx += sx; fy += sy;
      const nx = Math.floor(fx), ny = Math.floor(fy);
      if (nx === cx && ny === cy) continue;
      if (canMove(cx, cy, nx, ny)) {
        const d = cells[ny * W + nx], ocx = cx, ocy = cy;
        swap(cx, cy, nx, ny); cx = nx; cy = ny; moved = true;
        if (KIND[d] === K_LIQUID) {
          if (vy > 2.2) { const pj = ocy * W + ocx; VY[pj] = -vy * 0.45 - rf(); VX[pj] = (rf() - 0.5) * vy * 0.9; born[pj] = 1; }
          vx *= 0.55; vy *= 0.55;
        }
        continue;
      }
      if (nx !== cx && ny !== cy) {
        if (canMove(cx, cy, nx, cy)) { swap(cx, cy, nx, cy); cx = nx; moved = true; fy = cy + 0.5; vy *= 0.5; continue; }
        if (canMove(cx, cy, cx, ny)) { swap(cx, cy, cx, ny); cy = ny; moved = true; fx = cx + 0.5; vx *= 0.5; continue; }
      }
      if (ny > cy) { const k = liq ? 1.1 : 0.5; vx += (rf() - 0.5) * 2 * vy * k + (vx >= 0 ? 1 : -1) * vy * 0.12; vy = 0; }
      else if (ny < cy) vy = 0;
      if (nx !== cx) vx *= -0.3;
      break;
    }
    const j = cy * W + cx; VX[j] = vx; VY[j] = vy; if (moved) born[j] = 1;
    return moved;
  }
  function movePowder(x, y) {
    const i = y * W + x, m = cells[i];
    let vx = VX[i], vy = VY[i] + G; if (vy > MAXV) vy = MAXV;
    if (DENS[m] < 60) { const c = windC(x, y); vx += WU[c] * 0.06; vy += WV[c] * 0.05; }
    if (vy >= 1.2 || vy < 0 || vx >= 0.8 || vx <= -0.8) {
      if (ballistic(x, y, vx, vy, false)) return;
      vx = VX[i]; vy = 0;
    }
    const below = get(x, y + 1);
    if (KIND[below] === K_LIQUID && rf() < 0.6 - (DENS[m] - DENS[below]) / 200) { VY[i] = 0; VX[i] = vx * 0.5; return; }
    if (trySwap(x, y, x, y + 1)) {
      const j = i + W; VY[j] = vy; VX[j] = vx * 0.9;
      if (KIND[below] === K_LIQUID) { VY[j] = Math.min(VY[j] * 0.5, 0.5); splashUp(x, y); }
      return;
    }
    const fr = FRIC[m];
    if (fr > 0 && (rf() < fr || (fr >= 0.5 && !canMove(x, y + 1, x, y + 2)))) { vx *= 0.55; VY[i] = 0; VX[i] = (vx > -0.05 && vx < 0.05) ? 0 : vx; return; }
    const f = vx > 0.2 ? 1 : vx < -0.2 ? -1 : (ri(2) === 0 ? -1 : 1);
    if (trySwap(x, y, x + f, y + 1)) { const j = i + W + f; VY[j] = vy * 0.7; VX[j] = vx * 0.8 + f * 0.15; return; }
    if (trySwap(x, y, x - f, y + 1)) { const j = i + W - f; VY[j] = vy * 0.7; VX[j] = vx * 0.8 - f * 0.15; return; }
    VY[i] = 0; vx *= 0.55; VX[i] = (vx > -0.05 && vx < 0.05) ? 0 : vx;
  }
  function moveLiquid(x, y) {
    const i = y * W + x, m = cells[i];
    let vx = VX[i], vy = VY[i] + G; if (vy > MAXV) vy = MAXV;
    if (vy >= 1.5 || vy < 0 || vx >= 1.5 || vx <= -1.5) {
      if (ballistic(x, y, vx, vy, true)) return;
      vx = VX[i]; vy = 0;
    }
    const below = get(x, y + 1);
    if (trySwap(x, y, x, y + 1)) { const j = i + W; VY[j] = vy; VX[j] = vx; if (KIND[below] === K_LIQUID) splashUp(x, y); return; }
    if (VISC[m] > 0 && rf() < VISC[m]) { VY[i] = 0; VX[i] = vx * 0.8; return; }
    const f0 = ri(2) === 0 ? -1 : 1;
    if (trySwap(x, y, x + f0, y + 1)) { const j = i + W + f0; VY[j] = vy * 0.8; VX[j] = vx + f0 * 0.3; return; }
    if (trySwap(x, y, x - f0, y + 1)) { const j = i + W - f0; VY[j] = vy * 0.8; VX[j] = vx - f0 * 0.3; return; }
    const d = DISP[m] || 2;
    let side = vx > 0.3 ? 1 : vx < -0.3 ? -1 : f0;
    for (let a = 0; a < 2; a++, side = -side) {
      let cx = x;
      for (let k = 0; k < d; k++) {
        const nx = cx + side;
        if (!canMove(cx, y, nx, y)) break;
        swap(cx, y, nx, y); cx = nx;
        if (canMove(cx, y, cx, y + 1)) break;
      }
      if (cx !== x) { const j = y * W + cx; VX[j] = side * Math.min(1.2, Math.abs(vx) * 0.9 + 0.2); VY[j] = 0; born[j] = 1; return; }
    }
    VY[i] = 0; VX[i] = vx * 0.8;
  }
  function tryGas(x, y, dir) {
    const c = windC(x, y), u = WU[c], v = WV[c];
    if (rf() < Math.abs(u) * 0.5) { const s = u > 0 ? 1 : -1; if (trySwapUp(x, y, x + s, y)) { markBorn(x + s, y); return; } }
    if (rf() < 0.1) { const s = ri(2) === 0 ? -1 : 1; if (trySwapUp(x, y, x + s, y)) { markBorn(x + s, y); return; } }
    if (v > 0.35 && rf() < v * 0.3) { if (trySwapUp(x, y, x, y + 1)) { markBorn(x, y + 1); return; } }
    if (trySwapUp(x, y, x, y - 1)) { markBorn(x, y - 1); return; }
    const f = ri(2) === 0 ? -1 : 1;
    if (trySwapUp(x, y, x + f, y - 1)) { markBorn(x + f, y - 1); return; }
    if (trySwapUp(x, y, x - f, y - 1)) { markBorn(x - f, y - 1); return; }
    if (trySwapUp(x, y, x + f, y)) { markBorn(x + f, y); return; }
    if (trySwapUp(x, y, x - f, y)) { markBorn(x - f, y); return; }
  }
  function hasN(x, y, m) { for (let k = 0; k < 8; k++) if (get(x + DX[k], y + DY[k]) === m) return true; return false; }
  function wetN(x, y) { return hasN(x, y, WATER) || hasN(x, y, BRINE); }

  const AX = new Int16Array(8), AY = new Int16Array(8), BX = new Int16Array(8), BY = new Int16Array(8);
  function gatherAir(x, y) {
    let c = 0;
    for (let k = 0; k < 8; k++) { const nx = x + DX[k], ny = y + DY[k]; if (inb(nx, ny) && cells[ny * W + nx] === AIR) { AX[c] = nx; AY[c] = ny; c++; } }
    return c;
  }
  function cargoOf(s) { return s >= 64 ? 1 : s <= -40 ? 2 : 0; }
  function cargoMat(s) { const c = cargoOf(s); return c === 1 ? GOLD : c === 2 ? MUD : -1; }

  function transmute(x, y, into) {
    if (!inb(x, y)) return;
    const i = y * W + x; let dest = into;
    if (cells[i] === MITE || cells[i] === VISITOR) {
      const sp = cells[i] === VISITOR ? (shades[i] >= 64 ? GOLD : -1) : cargoMat(shades[i]);
      if (sp !== -1 && dest !== sp) {
        const ax = [], ay = [];
        for (let k = 0; k < 8; k++) { const nx = x + DX[k], ny = y + DY[k]; if (inb(nx, ny) && cells[ny * W + nx] === AIR) { ax.push(nx); ay.push(ny); } }
        if (ax.length) { const k = random.ecology.int(ax.length); transmute(ax[k], ay[k], sp); } else dest = sp;
      }
    }
    const prev = heat[i];
    setc(x, y, dest, grain(dest));
    const kept = prev > 20 ? prev - 20 : prev;
    if (kept > heat[i]) heat[i] = kept;
    born[i] = 1;
  }

  function growPlant(x, y) {
    // Plants are patient: one try in five, so a single seed greens a pond instead of paving it in two seconds.
    if (random.ecology.int(5) !== 0) return;
    let wet = false, plants = 0, ac = 0, gc = 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k], n = get(nx, ny);
      if (n === WATER || n === ASH) wet = true;
      if (n === PLANT) plants++;
      if (n === AIR) { AX[ac] = nx; AY[ac] = ny; ac++; }
      // Water is only claimed at the surface: a floating mat, not a pond turned solid.
      if (n === AIR || (n === WATER && get(nx, ny - 1) === AIR)) { BX[gc] = nx; BY[gc] = ny; gc++; }
    }
    if (wet && plants >= 2 && ac > 0) {
      const roll = random.ecology.int(6);
      if (roll === 0) { const k = random.ecology.int(ac); transmute(AX[k], AY[k], SEED); return; }
      if (roll === 1) { const k = random.ecology.int(ac); transmute(AX[k], AY[k], BLOOM); return; }
    }
    if (!wet || gc === 0) return;
    const k = random.ecology.int(gc); transmute(BX[k], BY[k], PLANT);
  }
  function creepMoss(x, y) {
    if (!hasN(x, y, WATER) && !hasN(x, y, MUD)) return;
    if (random.ecology.int(3) !== 0) return;
    let c = 0;
    for (let k = 0; k < 8; k++) { const nx = x + DX[k], ny = y + DY[k]; if (inb(nx, ny) && cells[ny * W + nx] === STONE) { AX[c] = nx; AY[c] = ny; c++; } }
    if (!c) return;
    const k = random.ecology.int(c); transmute(AX[k], AY[k], MOSS);
  }

  // ---------- ship / storm state ----------
  const ship = { active: false, x: 0, y: 24, t: 0, leaving: false, spawnCd: 0, stolen: 0, crash: false, beam: false };
  let shipCd = 0, storm = 0, stormT = 0, stormCd = 0, boltCd = 60, flash = 0;
  let goldCount = 0, goldCX = W / 2, goldCY = H / 2, visitorCount = 0;

  const blastHard = n => n === OBSIDIAN || n === AZOTH || n === RIFT;
  function detonate(cx, cy, r, seen) {
    const hit = seen || new Set();
    const origin = cy * 1024 + cx;
    if (hit.has(origin)) return;
    hit.add(origin);
    blastKick = Math.max(blastKick, r);
    ev({ t: 'blast', x: cx, y: cy, r });
    for (let y = Math.max(0, cy - r - 3); y <= Math.min(H - 1, cy + r + 3); y += 4) for (let x = Math.max(0, cx - r - 3); x <= Math.min(W - 1, cx + r + 3); x += 4) markDirty(x, y);
    markDirty(Math.min(W - 1, cx + r + 3), Math.min(H - 1, cy + r + 3));
    const chain = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dy * dy; if (d2 > r * r) continue;
      const nx = cx + dx, ny = cy + dy; if (!inb(nx, ny)) continue;
      const ni = ny * W + nx, n = cells[ni];
      if (blastHard(n)) continue;
      if ((n === TNT || n === NITRO) && d2 > 0) { chain.push(nx, ny, n === NITRO ? 6 : 4); continue; }
      if ((KIND[n] === K_POWDER || (KIND[n] === K_LIQUID && n !== WATER && n !== BRINE)) && d2 > 1) {
        const d = Math.sqrt(d2), sp = 1.4 + (r - d) / r * 5.5;
        VX[ni] = dx / d * sp + (rf() - 0.5); VY[ni] = dy / d * sp - 1.6 - rf();
        continue;
      }
      if (n === WATER || n === BRINE) { transmute(nx, ny, STEAM); VY[ni] = -2 - rf() * 2; VX[ni] = dx * 0.3; }
      else if (d2 <= 2) transmute(nx, ny, FIRE);
      else transmute(nx, ny, AIR);
    }
    // shockwave rim: loose powder just outside the blast is thrown outward too
    for (let dy = -r - 3; dy <= r + 3; dy++) for (let dx = -r - 3; dx <= r + 3; dx++) {
      const d2 = dx * dx + dy * dy; if (d2 <= r * r || d2 > (r + 3) * (r + 3)) continue;
      const nx = cx + dx, ny = cy + dy; if (!inb(nx, ny)) continue;
      const ni = ny * W + nx; if (KIND[cells[ni]] !== K_POWDER) continue;
      const d = Math.sqrt(d2), sp = 3 * (1 - (d - r) / 4);
      VX[ni] += dx / d * sp; VY[ni] += dy / d * sp - 1;
    }
    // kick the convection field outward
    const c0x = cx >> 3, c0y = cy >> 3;
    for (let gy = -2; gy <= 2; gy++) for (let gx = -2; gx <= 2; gx++) {
      const ccx = c0x + gx, ccy = c0y + gy; if (ccx < 0 || ccy < 0 || ccx >= CW || ccy >= CH) continue;
      const c = ccy * CW + ccx; WU[c] += gx * r * 0.15; WV[c] += gy * r * 0.15 - r * 0.05;
    }
    if (ship.active && Math.abs(cx - ship.x) < r + 15 && Math.abs(cy - ship.y) < r + 8) ship.crash = true;
    for (let i = 0; i < chain.length; i += 3) detonate(chain[i], chain[i + 1], chain[i + 2], hit);
  }

  function igniteCell(nx, ny, n) {
    if (!inb(nx, ny)) return false;
    switch (n) {
      case PLANT: case OIL: case SEED: case BLOOM: case POWDER: transmute(nx, ny, FIRE); return true;
      case WOOD: transmute(nx, ny, ri(2) === 0 ? FIRE : EMBER); return true;
      case SAND: transmute(nx, ny, GLASS); return true;
      case ICE: transmute(nx, ny, WATER); return true;
      case STONE: if (ri(6) === 0) transmute(nx, ny, LAVA); return true;
      case BRINE: transmute(nx, ny, CRYSTAL); return true;
      case MUD: transmute(nx, ny, BRICK); return true;
      case TNT: detonate(nx, ny, 4); return true;
      case NITRO: detonate(nx, ny, 6); return true;
    }
    return false;
  }
  function burn(x, y) {
    let wet = false, fueled = false;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k], n = get(nx, ny);
      if (n === WATER || n === BRINE) wet = true;
      if (igniteCell(nx, ny, n)) fueled = true;
    }
    if (wet) { transmute(x, y, STEAM); return; }
    if (fueled && ri(5) === 0 && get(x, y - 1) === AIR) transmute(x, y - 1, SMOKE);
    if (!fueled) transmute(x, y, ri(7) === 0 ? SMOKE : ASH);
  }
  function smolderEmber(x, y) {
    let fueled = false;
    for (let k = 0; k < 8; k++) { const nx = x + DX[k], ny = y + DY[k]; if (igniteCell(nx, ny, get(nx, ny))) fueled = true; }
    return fueled;
  }
  function cookLava(x, y) {
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
      const n = cells[ny * W + nx];
      if (n === WATER || n === BRINE || n === ICE) { transmute(nx, ny, STEAM); transmute(x, y, OBSIDIAN); return true; }
      if (n === STONE && ri(12) === 0) transmute(nx, ny, LAVA);
      if (n === SAND) transmute(nx, ny, GLASS);
      if (n === PLANT || n === WOOD || n === SEED || n === OIL || n === BLOOM) transmute(nx, ny, FIRE);
    }
    return false;
  }
  function cookAcid(x, y) {
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
      const n = cells[ny * W + nx];
      if (n === LEAD) { transmute(nx, ny, MERCURY); return false; }
      if (n === SALT) { transmute(x, y, WATER); return true; }
      if (n === STONE) { const ore = ri(18) === 0 ? GOLD : ri(3) === 0 ? LEAD : SAND; transmute(nx, ny, ore); return false; }
      if (n === PLANT || n === WOOD || n === MOSS || n === MUD || n === BLOOM || n === MITE || n === MINNOW) { transmute(nx, ny, AIR); return false; }
      if (n === VISITOR) { transmute(nx, ny, ICHOR); ev({ t: 'vkill', x: nx, y: ny }); return false; }
    }
    return false;
  }
  function devour(x, y) {
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
      const n = cells[ny * W + nx];
      if (n === AIR || n === STONE || n === GLASS || n === OBSIDIAN || n === AZOTH || n === VOID || n === CRYSTAL || n === RIFT || n === BRICK || n === PEARL || n === RELIC) continue;
      const life = n === PLANT || n === WOOD || n === SEED || n === MOSS || n === BLOOM || n === MITE || n === MINNOW || n === VISITOR;
      transmute(nx, ny, life && !hasN(x, y, AZOTH) ? VOID : AIR);
      return;
    }
  }
  function obsidianBox(x, y) { for (let k = 0; k < 8; k++) if (get(x + DX[k], y + DY[k]) !== OBSIDIAN) return false; return true; }
  function portalOpen(x, y) { const n = get(x, y); return n === AIR || n === FIRE || n === RIFT; }
  function rowOpen(x0, x1, y) { for (let x = x0; x <= x1; x++) if (!portalOpen(x, y)) return false; return true; }
  function obsidianRing(x0, y0, x1, y1) {
    for (let x = x0 - 1; x <= x1 + 1; x++) { if (get(x, y0 - 1) !== OBSIDIAN || get(x, y1 + 1) !== OBSIDIAN) return false; }
    for (let y = y0; y <= y1; y++) { if (get(x0 - 1, y) !== OBSIDIAN || get(x1 + 1, y) !== OBSIDIAN) return false; }
    return true;
  }
  function tryLightPortal(x, y) {
    if (!portalOpen(x, y)) return false;
    let x0 = x, x1 = x, y0 = y, y1 = y;
    while (x1 - x0 < 30 && portalOpen(x0 - 1, y)) x0--;
    while (x1 - x0 < 30 && portalOpen(x1 + 1, y)) x1++;
    if (x1 - x0 + 1 > 24) return false;
    while (y1 - y0 < 30 && rowOpen(x0, x1, y0 - 1)) y0--;
    while (y1 - y0 < 30 && rowOpen(x0, x1, y1 + 1)) y1++;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w < 2 || h < 2 || w > 24 || h > 24) return false;
    if (!obsidianRing(x0, y0, x1, y1)) return false;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) transmute(xx, yy, RIFT);
    ev({ t: 'portal', x: (x0 + x1) >> 1, y: (y0 + y1) >> 1 });
    return true;
  }
  function strikeRod(x, y) {
    if (get(x, y + 1) !== GOLD) return false;
    let n = 0, cy = y + 1; while (get(x, cy) === GOLD) { n++; cy++; }
    if (n < 6) return false;
    transmute(x, y, AIR); transmute(x, cy - 1, FIRE); return true;
  }
  function riftPull(x, y) {
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
      const n = cells[ny * W + nx];
      if (n === AIR || n === OBSIDIAN || n === RIFT || n === AZOTH || n === GLASS || n === CRYSTAL || n === GOLD || n === STONE || n === BRICK || n === PEARL || n === RELIC) continue;
      transmute(nx, ny, AETHER); return;
    }
  }
  function freezeWater(x, y) {
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
      const i = ny * W + nx;
      if (born[i] || cells[i] !== WATER || heat[i] >= 40) continue;
      if (ri(6) === 0) transmute(nx, ny, ICE);
    }
  }

  // ---------- critters ----------
  const isHeat = n => n === FIRE || n === LAVA || n === EMBER || n === ACID || n === PLASMA;
  const isForage = n => n === PLANT || n === BLOOM || n === MOSS;
  const forageRank = n => n === ICHOR ? 4 : n === BLOOM ? 3 : n === PLANT ? 2 : n === MOSS ? 1 : 0;
  const walkable = d => d === AIR || d === SAND || d === WATER || d === ASH || d === BRINE;
  const SX = new Int16Array(8), SY = new Int16Array(8), SS = new Int32Array(8); let PBX = 0, PBY = 0;
  function pickBest(c) {
    if (!c) return false;
    let best = SS[0]; for (let i = 1; i < c; i++) if (SS[i] > best) best = SS[i];
    let t = 0; for (let i = 0; i < c; i++) if (SS[i] === best) { SX[t] = SX[i]; SY[t] = SY[i]; t++; }
    const k = random.ecology.int(t); PBX = SX[k]; PBY = SY[k]; return true;
  }
  function miteDestScore(fx, fy, nx, ny, cargo) {
    const dest = get(nx, ny);
    let s = dest === AIR ? 2 : dest === SAND ? 4 : 0;
    if (dest === WATER || dest === BRINE) s -= 8;
    const from = get(fx, fy);
    if (from === WATER || from === BRINE) { if (dest === SAND || dest === MUD) s += 14; if (dest === AIR) s += 10; }
    const under = get(nx, ny + 1);
    if (under !== AIR && under !== STEAM && under !== AETHER && under !== FIRE) s += 4;
    for (let k = 0; k < 8; k++) {
      const qx = nx + DX[k], qy = ny + DY[k]; if (qx === fx && qy === fy) continue;
      const n = get(qx, qy);
      if (n === MITE) s += 10;
      if (n === BLOOM) s += 12; else if (isForage(n)) s += 8;
      if (n === GOLD && cargo === 1) s += 6;
      if (n === VISITOR) s += 16;
      if (n === ICHOR) s += 6;
      if (isHeat(n)) s -= 14;
      if (n === MINNOW) s -= 10;
    }
    const tr = trails[ny * W + nx];
    if (cargo === 0) s -= tr >> 6; else s += tr >> 4;
    return s;
  }
  function miteWalk(x, y, cargo) {
    let c = 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
      if (!walkable(cells[ny * W + nx])) continue;
      SX[c] = nx; SY[c] = ny; SS[c] = miteDestScore(x, y, nx, ny, cargo); c++;
    }
    if (!pickBest(c)) return false;
    swap(x, y, PBX, PBY); markBorn(PBX, PBY); return true;
  }
  function dropCargo(x, y, into) {
    let c = 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny) || cells[ny * W + nx] !== AIR) continue;
      SX[c] = nx; SY[c] = ny; SS[c] = hasN(nx, ny, into) ? 2 : 0; c++;
    }
    if (!pickBest(c)) return false;
    transmute(PBX, PBY, into);
    setc(x, y, MITE, rshade(SHADE[MITE]));
    return true;
  }
  let sHeat = false, sFood = -1, sFoodIchor = false, sGold = -1, sMud = -1, sKin = 0, sVis = false;
  function senseMite(x, y) {
    sHeat = false; sFood = -1; sFoodIchor = false; sGold = -1; sMud = -1; sKin = 0; sVis = false; let fr = 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
      const i = ny * W + nx, n = cells[i];
      if (isHeat(n)) sHeat = true;
      const r = forageRank(n); if (r > fr) { fr = r; sFood = i; sFoodIchor = n === ICHOR; }
      if (n === GOLD && sGold < 0) sGold = i;
      if (n === MUD && sMud < 0) sMud = i;
      if (n === MITE) sKin++;
      if (n === VISITOR) sVis = true;
    }
  }
  function pickUp(x, y, ci, shade) { transmute(ci % W, (ci / W) | 0, AIR); setc(x, y, MITE, shade); }
  function miteCling(x, y) {
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
      const n = cells[ny * W + nx];
      if (n === SAND || n === STONE || n === WOOD || n === GLASS || n === MUD || n === PLANT || n === BLOOM || n === GOLD || n === PEARL || n === BRICK || n === OBSIDIAN || n === ICE || n === MOSS || n === RELIC || n === VISITOR) return true;
    }
    return false;
  }
  function miteAct(x, y) {
    senseMite(x, y);
    const cargo = cargoOf(shades[y * W + x]);
    if (sHeat) { if (miteWalk(x, y, cargo)) return true; transmute(x, y, ASH); return true; }
    if (sVis) return true;
    if (sFood >= 0) {
      const fx = sFood % W, fy = (sFood / W) | 0;
      if (sFoodIchor || !hasN(fx, fy, MUD)) {
        const kin = sKin, ichor = sFoodIchor;
        transmute(fx, fy, AIR);
        const ac = gatherAir(x, y);
        if ((ichor || kin > 0) && ac > 0 && random.ecology.int(ichor ? 2 : 5) === 0) { const k = random.ecology.int(ac); transmute(AX[k], AY[k], MITE); }
        return true;
      }
    }
    if (cargo === 1 && sGold >= 0 && dropCargo(x, y, GOLD)) return true;
    if (cargo === 0 && sGold >= 0) { pickUp(x, y, sGold, GOLD_CARRY); return true; }
    if (cargo === 2 && (sKin >= 2 || sMud >= 0) && dropCargo(x, y, MUD)) return true;
    if (cargo === 0 && sMud >= 0 && sKin < 2) {
      const mx = sMud % W, my = (sMud / W) | 0;
      if (!hasN(mx, my, PLANT) && !hasN(mx, my, BLOOM)) { pickUp(x, y, sMud, MUD_CARRY); return true; }
    }
    const below = get(x, y + 1);
    const hanging = below === AIR || below === STEAM || below === FIRE || below === AETHER || below === SMOKE;
    if (hanging && !miteCling(x, y)) return false;
    if (random.ecology.int(sKin >= 2 ? 8 : 3) !== 0) return true;
    miteWalk(x, y, cargo);
    return true;
  }
  function minnowScore(nx, ny) {
    let s = 0; const t = heat[ny * W + nx];
    if (t > 40) s -= t >> 2;
    if (ny > 0 && cells[(ny - 1) * W + nx] === AIR) s += 2;
    for (let k = 0; k < 8; k++) {
      const n = get(nx + DX[k], ny + DY[k]);
      if (n === MINNOW) s += 5; else if (n === MITE) s += 3; else if (n === SEED) s += 4; else if (n === CRYSTAL) s += 2; else if (n === PEARL) s += 1;
      else if (n === OIL || n === LAVA || n === FIRE || n === ACID || n === NITRO) s -= 20;
    }
    return s;
  }
  function minnowAct(x, y) {
    let hurt = false, mite = -1, seed = -1, crystal = false, kin = false, wc = 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
      const i = ny * W + nx, n = cells[i];
      if (n === OIL || n === LAVA || n === FIRE || n === ACID || n === NITRO || n === PLASMA) hurt = true;
      if (n === MITE && mite < 0) mite = i;
      if (n === SEED && seed < 0) seed = i;
      if (n === CRYSTAL) crystal = true;
      if (n === MINNOW) kin = true;
      if (n === WATER || n === BRINE) { BX[wc] = nx; BY[wc] = ny; wc++; }
    }
    if (hurt) { transmute(x, y, ASH); return true; }
    if (mite >= 0) { transmute(mite % W, (mite / W) | 0, WATER); return true; }
    if (seed >= 0) { transmute(seed % W, (seed / W) | 0, WATER); return true; }
    if (crystal && random.ecology.int(6) === 0) {
      const ac = gatherAir(x, y);
      if (ac > 0) { const k = random.ecology.int(ac); transmute(AX[k], AY[k], PEARL); return true; }
      if (wc > 0) { const k = random.ecology.int(wc); transmute(BX[k], BY[k], PEARL); return true; }
    }
    if (wc === 0) return kin;
    for (let i = 0; i < wc; i++) { SX[i] = BX[i]; SY[i] = BY[i]; SS[i] = minnowScore(BX[i], BY[i]); }
    if (!pickBest(wc)) return true;
    swap(x, y, PBX, PBY); markBorn(PBX, PBY); return true;
  }
  function hatchMite(x, y) {
    if (!hasN(x, y, PLANT) && !hasN(x, y, BLOOM)) return;
    if (!wetN(x, y)) return;
    if (random.ecology.int(8) !== 0) return;
    const ac = gatherAir(x, y); if (!ac) return;
    const k = random.ecology.int(ac); transmute(AX[k], AY[k], MITE);
  }
  function dewSteam(x, y) {
    const above = y === 0 ? STONE : get(x, y - 1);
    return (y === 0 || !MOV[above]) && hasN(x, y, STEAM);
  }

  // Visitors: fly, seek gold, carry it to the ship. Mites swarm them.
  const flyable = d => d === AIR || d === STEAM || d === SMOKE || d === CLOUD || d === AETHER || d === WATER || d === BRINE;
  function visitorDie(x, y) { transmute(x, y, ICHOR); ev({ t: 'vkill', x, y }); }
  function visitorAct(x, y) {
    const i = y * W + x, carrying = shades[i] >= 64;
    let mites = 0, hurt = false, goldI = -1, miteI = -1;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
      const j = ny * W + nx, n = cells[j];
      if (n === MITE) { mites++; miteI = j; }
      if (n === FIRE || n === LAVA || n === ACID || n === PLASMA || n === EMBER || n === VOID) hurt = true;
      if (n === GOLD && goldI < 0) goldI = j;
    }
    if (hurt) { visitorDie(x, y); return true; }
    if (mites > 0) {
      if (random.ecology.int(5) < mites) { visitorDie(x, y); return true; }
      if (random.ecology.int(3) === 0) { transmute(miteI % W, (miteI / W) | 0, ASH); ev({ t: 'zap', x, y }); return true; }
    }
    if (!carrying && goldI >= 0 && random.ecology.int(2) === 0) { transmute(goldI % W, (goldI / W) | 0, AIR); shades[i] = 90; return true; }
    if (ship.active && carrying && Math.abs(x - ship.x) < 6 && y <= ship.y + 6) { setc(x, y, AIR, 0); ship.stolen++; ev({ t: 'stolen' }); return true; }
    if (!ship.active && (y <= 1 || x <= 1 || x >= W - 2)) { setc(x, y, AIR, 0); return true; }
    if (random.ecology.int(3) === 0) return true;
    let tx, ty;
    if (carrying || !ship.active || ship.leaving || goldCount === 0) { tx = ship.active ? ship.x : (x < W / 2 ? -20 : W + 20); ty = ship.active ? ship.y + 4 : -10; }
    else { tx = goldCX; ty = goldCY; }
    let c = 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
      if (!flyable(cells[ny * W + nx])) continue;
      SX[c] = nx; SY[c] = ny; SS[c] = -Math.round(Math.hypot(tx - nx, ty - ny) * 4) + random.ecology.int(6); c++;
    }
    if (!pickBest(c)) return true;
    swap(x, y, PBX, PBY); markBorn(PBX, PBY);
    return true;
  }
  function shipStep() {
    if (shipCd > 0) shipCd--;
    if (!ship.active) return;
    ship.t++;
    if (ship.crash) {
      const sx = Math.round(ship.x), sy = Math.round(ship.y);
      ship.active = false; ship.crash = false; shipCd = 60 * 120;
      for (let k = 0; k < 26; k++) {
        const px = sx + random.ecology.int(25) - 12, py = sy + random.ecology.int(5) - 2;
        if (!inb(px, py)) continue;
        const m = k % 3 === 0 ? ICHOR : RELIC;
        setc(px, py, m, grain(m)); const j = py * W + px; VX[j] = (px - sx) * 0.4 + (random.ecology.float() - 0.5) * 2; VY[j] = -2 - random.ecology.float() * 3;
      }
      detonate(sx, sy + 2, 5);
      ev({ t: 'shipdown', x: sx, y: sy });
      return;
    }
    const targetX = Math.max(30, Math.min(W - 30, goldCX));
    if (!ship.leaving && (ship.t > 60 * 55 || ship.stolen >= 90 || (goldCount === 0 && ship.t > 600))) { ship.leaving = true; ev({ t: 'shipleave' }); }
    if (ship.leaving) {
      ship.x += ship.x < W / 2 ? -1.6 : 1.6; ship.y -= 0.05; ship.beam = false;
      if (ship.x < -40 || ship.x > W + 40) { ship.active = false; shipCd = 60 * 90; }
      return;
    }
    const dx = targetX - ship.x;
    ship.x += Math.max(-0.9, Math.min(0.9, dx * 0.02));
    ship.y = 24 + Math.sin(ship.t * 0.05) * 2;
    ship.beam = Math.abs(dx) < 14;
    if (ship.beam && --ship.spawnCd <= 0 && visitorCount < 14) {
      const vx = Math.round(ship.x) + random.ecology.int(5) - 2, vy = Math.round(ship.y) + 5;
      if (inb(vx, vy) && flyable(cells[vy * W + vx])) { setc(vx, vy, VISITOR, grain(VISITOR)); visitorCount++; }
      ship.spawnCd = 45 + random.ecology.int(30);
    }
  }
  function shipArrive() {
    ship.active = true; ship.leaving = false; ship.t = 0; ship.stolen = 0; ship.crash = false; ship.spawnCd = 90;
    ship.x = goldCX < W / 2 ? W + 30 : -30; ship.y = 24;
    ev({ t: 'ship' });
  }

  // Storms: steam gathers, clouds form, bolts fall.
  function startStorm() { if (storm > 0) return; storm = 60 * 40; stormT = 0; boltCd = 90; ev({ t: 'storm' }); }
  function strikeAt(hx, hy) {
    const m0 = cells[hy * W + hx];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = hx + dx, ny = hy + dy; if (!inb(nx, ny)) continue;
      const j = ny * W + nx; heat[j] = 255; markDirty(nx, ny);
      const n = cells[j];
      if (n === VISITOR) { visitorDie(nx, ny); continue; }
      if (n === MITE) { transmute(nx, ny, ASH); continue; }
      igniteCell(nx, ny, n);
    }
    if (m0 === SAND || m0 === GLASS) {
      let x = hx, made = 0;
      for (let k = 0; k < 14; k++) { const y = hy + k; if (!inb(x, y)) break; const n = cells[y * W + x]; if (n === SAND) { transmute(x, y, GLASS); made++; } else if (n !== GLASS) break; x += random.weather.int(3) - 1; }
      if (made) ev({ t: 'fulgurite', x: hx, y: hy });
    }
    if (m0 === WATER || m0 === BRINE) {
      const q = [hy * W + hx], seen = new Set(q); let n = 0, killed = 0;
      while (q.length && n < 900) {
        const j = q.shift(); n++;
        const x = j % W, y = (j / W) | 0;
        for (let k = 0; k < 8; k++) {
          const nx = x + DX[k], ny = y + DY[k]; if (!inb(nx, ny)) continue;
          const jj = ny * W + nx; if (seen.has(jj)) continue; seen.add(jj);
          const c = cells[jj];
          if (c === MINNOW || c === MITE) { transmute(nx, ny, ASH); killed++; }
          else if (c === WATER || c === BRINE) { q.push(jj); if (random.weather.int(40) === 0) transmute(nx, ny, STEAM); }
        }
      }
      ev({ t: 'shock', x: hx, y: hy, killed });
    }
    if (m0 === GOLD || m0 === LEAD || m0 === MERCURY || m0 === RELIC) {
      let y = hy; while (y + 1 < H) { const n = cells[(y + 1) * W + hx]; if (n === GOLD || n === LEAD || n === MERCURY || n === RELIC) y++; else break; }
      for (let k = 0; k < 8; k++) { const nx = hx + DX[k], ny = y + 1 + DY[k]; if (inb(nx, ny)) { const n = cells[ny * W + nx]; if (n === AIR) transmute(nx, ny, FIRE); else igniteCell(nx, ny, n); } }
    }
  }
  function strike() {
    let ox = -1, oy = -1;
    for (let t = 0; t < 80; t++) { const x = 3 + random.weather.int(W - 6), y = 1 + random.weather.int(18); if (cells[y * W + x] === CLOUD) { ox = x; oy = y; break; } }
    if (ox < 0) { ox = 10 + random.weather.int(W - 20); oy = 1; }
    let tx = ox, best = 1e9;
    for (let t = 0; t < 48; t++) {
      const x = Math.max(2, Math.min(W - 3, ox + random.weather.int(181) - 90));
      for (let y = oy + 1; y < H; y++) {
        const m = cells[y * W + x];
        if (m === AIR || KIND[m] === K_GAS) continue;
        const metal = m === GOLD || m === LEAD || m === MERCURY || m === RELIC;
        const sc = y - (metal ? 90 : 0) + Math.abs(x - ox) * 0.35;
        if (sc < best) { best = sc; tx = x; }
        break;
      }
    }
    let x = ox, y = oy + 1, hit = -1;
    const path = [];
    while (y < H) {
      if (ship.active && Math.abs(x - ship.x) < 13 && Math.abs(y - ship.y) < 5) { ship.crash = true; break; }
      const m = cells[y * W + x];
      if (!(m === AIR || m === CLOUD || KIND[m] === K_GAS || m === PLASMA)) { hit = y * W + x; break; }
      path.push(y * W + x);
      if (path.length > 8 && random.weather.float() < 0.035) {
        let bx = x, by = y, dir = random.weather.float() < 0.5 ? -1 : 1;
        for (let k = 0; k < 8 + random.weather.int(14); k++) { bx += dir; by += random.weather.int(2); if (!inb(bx, by)) break; const bm = cells[by * W + bx]; if (bm === AIR || KIND[bm] === K_GAS) path.push(by * W + bx); else break; }
      }
      const r = random.weather.float(); x += r < 0.28 ? -1 : r < 0.56 ? 1 : 0;
      if (random.weather.float() < 0.5) x += tx > x ? 1 : tx < x ? -1 : 0;
      x = Math.max(1, Math.min(W - 2, x));
      y++;
    }
    for (const j of path) { cells[j] = PLASMA; shades[j] = 3 + random.weather.int(3); heat[j] = 255; VX[j] = 0; VY[j] = 0; born[j] = 1; markDirty(j % W, (j / W) | 0); }
    let hx = x, hy = y;
    if (hit >= 0) { hx = hit % W; hy = (hit / W) | 0; strikeAt(hx, hy); }
    flash = 1;
    ev({ t: 'bolt', x0: ox, y0: oy, x: hx, y: hy });
  }
  function stormStep() {
    if (stormCd > 0) stormCd--;
    if (storm <= 0) return;
    storm--; stormT++;
    for (let k = 0; k < 6; k++) {
      const x = 2 + random.weather.int(W - 4);
      const band = 7 + 5 * Math.sin(x * 0.03 + stormT * 0.004) + 3 * Math.sin(x * 0.11 - stormT * 0.006);
      const y = 1 + random.weather.int(Math.max(2, band | 0));
      if (cells[y * W + x] === AIR) setc(x, y, CLOUD, grain(CLOUD));
    }
    if (--boltCd <= 0) { strike(); boltCd = 50 + random.weather.int(200); }
    if (storm === 0) { stormCd = 60 * 60; ev({ t: 'stormend' }); }
  }

  // ---------- reactions ----------
  function react(x, y, m) {
    switch (m) {
      case SEED: if (hasN(x, y, WATER) || hasN(x, y, MUD)) { transmute(x, y, PLANT); return true; } return false;
      case ASH: if (hasN(x, y, WATER)) { transmute(x, y, MUD); return true; } return false;
      case SALT:
        if (hasN(x, y, ASH)) { transmute(x, y, POWDER); return true; }
        if (wetN(x, y)) { transmute(x, y, BRINE); return true; }
        return false;
      case STEAM:
        if (hasN(x, y, ICE)) { transmute(x, y, WATER); return true; }
        if (hasN(x, y, CRYSTAL)) { transmute(x, y, AETHER); return true; }
        if (dewSteam(x, y)) { transmute(x, y, WATER); return true; }
        return false;
      case SMOKE: if (ri(420) === 0) { transmute(x, y, AIR); return true; } return false;
      case CLOUD:
        if (storm <= 0 && random.weather.int(100) === 0) { transmute(x, y, AIR); return true; }
        if (storm > 0 && random.weather.int(240) === 0 && get(x, y + 1) === AIR) { transmute(x, y + 1, WATER); VY[(y + 1) * W + x] = 1.2; }
        return false;
      case PLASMA: { const i = y * W + x; if (shades[i] <= 1) { transmute(x, y, AIR); return true; } shades[i]--; return true; }
      case MITE: return miteAct(x, y);
      case MINNOW: return minnowAct(x, y);
      case VISITOR: return visitorAct(x, y);
      case ICHOR: if (hasN(x, y, FIRE) || hasN(x, y, PLASMA)) { transmute(x, y, AETHER); return true; } return false;
      case MUD: hatchMite(x, y); return false;
      case ACID: return cookAcid(x, y);
      case LEAD: {
        const az = hasN(x, y, AZOTH);
        if (az || hasN(x, y, ACID)) { transmute(x, y, az ? GOLD : MERCURY); return true; }
        return false;
      }
      case MERCURY:
        if (hasN(x, y, LEAD) && hasN(x, y, FIRE)) {
          for (let k = 0; k < 8; k++) { const nx = x + DX[k], ny = y + DY[k]; if (get(nx, ny) === LEAD) { transmute(nx, ny, GOLD); return false; } }
        }
        return false;
      case AETHER:
        if (strikeRod(x, y)) return true;
        if (hasN(x, y, GOLD) && hasN(x, y, CRYSTAL)) { transmute(x, y, AZOTH); return true; }
        return false;
      case OIL: if (hasN(x, y, POWDER)) { transmute(x, y, NITRO); return true; } return false;
      case TNT: case NITRO:
        if (hasN(x, y, FIRE) || hasN(x, y, EMBER) || hasN(x, y, LAVA) || hasN(x, y, PLASMA)) { detonate(x, y, m === NITRO ? 6 : 4); return true; }
        return false;
      case RIFT: riftPull(x, y); return false;
      case SAND: if (get(x, y + 1) === BRINE) { transmute(x, y, STONE); return true; } return false;
      case CRYSTAL:
        if (y + 1 < H && get(x, y + 1) === AIR && (hasN(x, y, WATER) || hasN(x, y, ICE)) && ri(6) === 0) transmute(x, y + 1, WATER);
        return false;
      case AZOTH:
        for (let k = 0; k < 8; k++) { const nx = x + DX[k], ny = y + DY[k]; if (get(nx, ny) === LEAD) transmute(nx, ny, GOLD); }
        return false;
      case VOID: devour(x, y); return false;
      case ICE: freezeWater(x, y); return false;
      case PLANT: growPlant(x, y); return false;
      case MOSS: creepMoss(x, y); return false;
      case FIRE:
        if (obsidianBox(x, y)) { transmute(x, y, VOID); ev({ t: 'void', x, y }); return true; }
        if (tryLightPortal(x, y)) return true;
        burn(x, y); return true;
      case LAVA: return cookLava(x, y);
      case EMBER: {
        const fueled = smolderEmber(x, y);
        if (wetN(x, y)) { transmute(x, y, STEAM); return true; }
        const moved = tryDownAndDiags(x, y);
        if (!moved && !fueled) transmute(x, y, ASH);
        return true;
      }
    }
    return false;
  }

  // ---------- fields ----------
  function thermals() {
    for (let i = 0; i < N; i++) { const s = SOURCE[cells[i]]; if (s > heat[i]) heat[i] = s; }
    for (let y = H - 1; y >= 1; y--) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = row + x;
        if (born[i]) continue;
        const m = cells[i];
        if (SOURCE[m] > 0 || cells[i - W] !== m) continue;
        if (heat[i] < heat[i - W] + 24) continue;
        swap(x, y, x, y - 1); born[i - W] = 1;
      }
    }
    let melts = 0;
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
      const c = cy * CW + cx, y0 = cy << 3, y1 = Math.min(H, y0 + 8), x0 = cx << 3, x1 = x0 + 8;
      // A quiet chunk (one material, every cell at its resting heat) among quiet, unchanged
      // neighbours would recompute to exactly the same heat, so it is skipped.
      let fast = tQuiet[c];
      for (let dy = -1; dy <= 1 && fast; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue;
        const n = ny * CW + nx; if (!tQuiet[n] || dirty[n]) { fast = 0; break; }
      }
      tFast[c] = fast;
      if (fast) { HS[c] = qHS[c]; SOL[c] = qSOL[c]; live[c] = qLive[c]; continue; }
      let hs = 0, sol = 0, lv = 0, quiet = 1;
      const m0 = cells[y0 * W + x0];
      for (let y = y0; y < y1; y++) {
        const row = y * W;
        for (let x = x0; x < x1; x++) {
          const i = row + x, t = heat[i], m = cells[i];
          const up = y > 0 ? heat[i - W] : t, dn = y < H - 1 ? heat[i + W] : t;
          const rt = x < W - 1 ? heat[i + 1] : t, lf = x > 0 ? heat[i - 1] : t;
          let next = t + ((CONDUCT[m] * (up + dn + rt + lf - (t << 2))) >> 5);
          next += ((AMBIENT[m] - next) * (m === AIR || m === STEAM || m === SMOKE ? 10 : 2)) >> 8;
          const v = next < 0 ? 0 : next > 255 ? 255 : next;
          heatOut[i] = v;
          hs += v;
          if (ALIVE[m] || KIND[m] === K_GAS) lv = 1;
          if (m !== AIR && KIND[m] !== K_GAS && m !== FIRE && m !== PLASMA) sol++;
          if (m !== m0 || v !== AMBIENT[m]) quiet = 0;
          if (m === ICE && v >= 72 && !born[i]) meltList[melts++] = i;
        }
      }
      HS[c] = qHS[c] = hs; SOL[c] = qSOL[c] = sol; live[c] = qLive[c] = lv; tQuiet[c] = quiet;
    }
    for (let c = 0; c < CNN; c++) {
      if (tFast[c]) continue;
      const y0 = (c / CW | 0) << 3, x0 = (c % CW) << 3, y1 = Math.min(H, y0 + 8);
      for (let y = y0; y < y1; y++) { const i = y * W + x0; heat.set(heatOut.subarray(i, i + 8), i); }
    }
    for (let k = 0; k < melts; k++) { const i = meltList[k]; if (cells[i] === ICE && !born[i]) transmute(i % W, (i / W) | 0, WATER); }
  }
  function stigmergy() {
    let mites = 0;
    for (let i = 0; i < N; i++) {
      if (cells[i] !== MITE) continue;
      mites++;
      const next = trails[i] + (cargoOf(shades[i]) === 0 ? 6 : 14);
      trails[i] = next > 255 ? 255 : next;
    }
    if (!mites && !trailsLive) return;
    let any = false;
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = row + x, t = trails[i];
        const up = y > 0 ? trails[i - W] : t, dn = y < H - 1 ? trails[i + W] : t;
        const rt = x < W - 1 ? trails[i + 1] : t, lf = x > 0 ? trails[i - 1] : t;
        let next = t + ((6 * (up + dn + rt + lf - (t << 2))) >> 5);
        next -= (12 * t) >> 8;
        const v = next < 0 ? 0 : next > 255 ? 255 : next;
        trailOut[i] = v; if (v) any = true;
      }
    }
    trails.set(trailOut);
    trailsLive = any;
  }
  function processCell(x, y, dir) {
    const i = y * W + x;
    if (born[i]) return;
    const m = cells[i];
    if (m === AIR) return;
    if (react(x, y, m)) return;
    const k = KIND[cells[i]];
    if (k === K_POWDER) movePowder(x, y);
    else if (k === K_LIQUID) moveLiquid(x, y);
    else if (k === K_GAS) tryGas(x, y, dir);
  }
  function simulate() {
    const dir = scanDir; scanDir = -scanDir;
    born.fill(0);
    thermals();
    windStep();
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
      const c = cy * CW + cx;
      let on = live[c];
      for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < CW && ny < CH && dirty[ny * CW + nx]) { on = 1; break; }
      }
      awake[c] = on;
    }
    dirty.fill(0);
    for (let y = H - 1; y >= 0; y--) {
      const row = (y >> 3) * CW;
      if (dir === 1) { for (let cx = 0; cx < CW; cx++) if (awake[row + cx]) for (let x = cx << 3, e = x + 8; x < e; x++) processCell(x, y, dir); }
      else { for (let cx = CW - 1; cx >= 0; cx--) if (awake[row + cx]) for (let x = (cx << 3) + 7, e = cx << 3; x >= e; x--) processCell(x, y, dir); }
    }
    stigmergy();
    stormStep();
    shipStep();
  }

  // ---------- world ----------
  // The legacy 'reset' opcode reseeds only the scene; it never touches the command queue.
  function seedVessel(spark = true) {
    const w = W, h = H;
    const floorN = Math.max(3, Math.round(h * 0.018)), wallN = Math.max(3, Math.round(w * 0.01)), ground = h - floorN;
    fill(0, ground, w - 1, h - 1, STONE); fill(0, 0, wallN - 1, h - 1, STONE); fill(w - wallN, 0, w - 1, h - 1, STONE);
    const sandX = Math.round(w * 0.22), sandR = Math.max(8, Math.round(w * 0.048));
    paint(sandX, ground - 1, sandR, SAND); paint(sandX + sandR, ground - 1, Math.round(sandR * 0.55), SAND);
    setc(sandX - 8, ground - sandR - 2, SEED, grain(SEED)); setc(sandX - 5, ground - sandR, SEED, grain(SEED));
    const duneTop = Math.max(1, ground - sandR);
    setc(sandX, duneTop + 1, MITE, grain(MITE)); setc(sandX + 3, duneTop + 3, MITE, grain(MITE));
    setc(sandX - 2, ground - 3, MITE, grain(MITE)); setc(sandX + 6, ground - 2, MITE, grain(MITE));
    const gx = Math.min(w - wallN - 6, sandX + sandR + 2);
    setc(gx, ground - 1, MUD, grain(MUD)); setc(gx + 1, ground - 1, MUD, grain(MUD));
    setc(gx, ground - 2, PLANT, grain(PLANT)); setc(gx + 1, ground - 2, PLANT, grain(PLANT)); setc(gx + 2, ground - 2, PLANT, grain(PLANT));
    setc(gx + 2, ground - 1, WATER, grain(WATER));
    const wx0 = Math.round(w * 0.4), wx1 = Math.round(w * 0.56), trough = Math.max(8, Math.round(h * 0.07));
    fill(wx0, ground - trough - 3, wx0, ground - 1, STONE); fill(wx1, ground - trough - 3, wx1, ground - 1, STONE);
    fill(wx0 + 1, ground - trough + 1, wx1 - 1, ground - 1, WATER);
    const mx = Math.round((wx0 + wx1) / 2);
    setc(mx, ground - 2, MINNOW, grain(MINNOW)); setc(mx + 2, ground - 3, MINNOW, grain(MINNOW));
    const woodX = Math.round(w * 0.62);
    paint(woodX, ground - 3, Math.max(4, Math.round(w * 0.012)), WOOD); paint(woodX + 7, ground - 2, Math.max(3, Math.round(w * 0.01)), WOOD);
    setc(woodX - 8, ground - 1, TNT, grain(TNT)); setc(woodX - 7, ground - 1, TNT, grain(TNT));
    const iceX = Math.round(w * 0.72); paint(iceX, ground - 5, Math.max(7, Math.round(w * 0.022)), ICE);
    const saltX = Math.round(w * 0.12), tableY = ground - Math.max(14, Math.round(h * 0.07));
    fill(saltX - 11, tableY, saltX + 11, tableY + 1, STONE);
    setc(saltX - 11, tableY - 1, STONE, grain(STONE)); setc(saltX + 11, tableY - 1, STONE, grain(STONE));
    paint(saltX - 4, tableY - 3, Math.max(3, Math.round(w * 0.01)), SALT); paint(saltX + 6, tableY - 3, Math.max(3, Math.round(w * 0.01)), LEAD);
    const dish = Math.round(w * 0.32), dishH = Math.max(8, Math.round(h * 0.045));
    fill(dish - 7, ground - 1, dish + 7, ground - 1, GLASS); fill(dish - 7, ground - dishH, dish - 7, ground - 1, GLASS); fill(dish + 7, ground - dishH, dish + 7, ground - 1, GLASS);
    fill(dish - 6, ground - dishH + 1, dish + 6, ground - 2, ACID);
    const lx = Math.round(w * 0.88), cupW = Math.max(10, Math.round(w * 0.024)), cupH = Math.max(14, Math.round(h * 0.06)), cupBottom = ground - cupH;
    fill(lx - cupW, cupBottom, lx + cupW, cupBottom, GLASS); fill(lx - cupW, cupBottom, lx - cupW, ground - 1, GLASS); fill(lx + cupW, cupBottom, lx + cupW, ground - 1, GLASS);
    paint(lx, ground - Math.max(5, Math.round(cupH * 0.45)), Math.max(3, cupW - 7), LAVA);
    const px = wallN + 6, py = Math.max(8, Math.round(h * 0.22));
    fill(px, py, px + 3, py, OBSIDIAN); fill(px, py + 4, px + 3, py + 4, OBSIDIAN); fill(px, py, px, py + 4, OBSIDIAN); fill(px + 3, py, px + 3, py + 4, OBSIDIAN);
    // The vessel is charged: a fuse joins the wood pile to the casks, and a spark finds the wood eight seconds in.
    setc(woodX - 6, ground - 1, POWDER, grain(POWDER));
    if (spark) scheduleSpark(woodX, Math.max(1, ground - 40));
  }
  const SPARK_DELAY = 480;
  let opTick = 0;
  function dropSparks() { commands = commands.filter(command => command.op.t !== 'spark'); }
  function scheduleSpark(x, y) {
    const tick = opTick + SPARK_DELAY;
    const sequence = commands.reduce((next, c) => c.tick === tick ? Math.max(next, c.sequence + 1) : next, 0);
    commands = [...commands, { tick, sequence, op: { t: 'spark', x, y } }].sort((a, b) => a.tick - b.tick || a.sequence - b.sequence);
  }
  function rainFromCeiling(m, count) {
    const span = Math.max(1, W - 2);
    for (let i = 0; i < count; i++) setc(1 + (i % span), 1, m, grain(m));
  }

  // ---------- tools ----------
  function spray(cx, cy, r, m, n) {
    for (let k = 0; k < n; k++) {
      const a = rf() * Math.PI * 2, d = Math.sqrt(rf()) * r, x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
      if (!inb(x, y)) continue;
      const i = y * W + x;
      if (m === AIR) { if (cells[i] !== AIR) setc(x, y, AIR, 0); continue; }
      if (cells[i] !== AIR) continue;
      setc(x, y, m, grain(m)); VX[i] = (rf() - 0.5) * 0.6; VY[i] = rf() * 0.8;
    }
  }
  function heatWand(cx, cy, r, hot) {
    const r2 = r * r;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > r2 || !inb(x, y)) continue;
      const i = y * W + x, m = cells[i];
      markDirty(x, y);
      if (hot) {
        heat[i] = Math.min(255, heat[i] + 36);
        if (m === ICE && ri(3) === 0) transmute(x, y, WATER);
        else if ((m === WATER || m === BRINE) && ri(m === BRINE ? 14 : 7) === 0) { if (m === BRINE && ri(4) === 0) transmute(x, y, CRYSTAL); else transmute(x, y, STEAM); }
        else if (FLAMMABLE[m] && ri(9) === 0) transmute(x, y, FIRE);
        else if ((m === TNT || m === NITRO) && ri(12) === 0) detonate(x, y, m === NITRO ? 6 : 4);
        else if (m === SAND && ri(60) === 0) transmute(x, y, GLASS);
        else if (m === MUD && ri(24) === 0) transmute(x, y, BRICK);
        else if (m === STONE && ri(260) === 0) transmute(x, y, LAVA);
        else if (m === MITE && ri(6) === 0) transmute(x, y, ASH);
        else if (m === VISITOR && ri(4) === 0) visitorDie(x, y);
      } else {
        heat[i] = Math.max(0, heat[i] - 50);
        if (m === WATER && ri(5) === 0) transmute(x, y, ICE);
        else if (m === BRINE && ri(40) === 0) transmute(x, y, ICE);
        else if (m === STEAM && ri(3) === 0) transmute(x, y, WATER);
        else if (m === CLOUD && ri(8) === 0) transmute(x, y, WATER);
        else if (m === LAVA && ri(4) === 0) transmute(x, y, OBSIDIAN);
        else if (m === FIRE && ri(2) === 0) transmute(x, y, SMOKE);
        else if (m === EMBER && ri(3) === 0) transmute(x, y, ASH);
      }
    }
  }

  // ---------- blit: color (rgb + id in alpha), emission, fx (occupancy, light gas, liquid, smoke) ----------
  function blit(color, emis, fx, tick) {
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = row + x, o = i << 2, m = cells[i], t = heat[i];
        if (m === AIR) {
          let r = 14, b = 20;
          if (t > 64) { const q = (t - 64) >> 3; r += q; b -= q >> 1; if (b < 0) b = 0; }
          color[o] = r; color[o + 1] = 14; color[o + 2] = b; color[o + 3] = 0;
          if (t > 110) { const e = (t - 110) >> 2; emis[o] = e; emis[o + 1] = e >> 2; emis[o + 2] = 0; } else { emis[o] = 0; emis[o + 1] = 0; emis[o + 2] = 0; }
          fx[o] = 0; fx[o + 1] = 0; fx[o + 2] = 0; fx[o + 3] = 0;
          continue;
        }
        const s = shades[i];
        let r = CR[m] + s, g = CG[m] + s, b = CB[m] + s;
        if (!NOAO[m]) {
          let ao = 0;
          if (y + 1 < H && cells[i + W] !== AIR) ao += 4;
          if (x > 0 && cells[i - 1] !== AIR) ao += 3;
          if (x + 1 < W && cells[i + 1] !== AIR) ao += 3;
          if (y > 0 && cells[i - W] !== AIR) ao += 2;
          r -= ao; g -= ao; b -= ao;
        }
        if (tick !== 0) {
          switch (m) {
            case FIRE: { const p = ((i * 13 + tick * 9) & 15) - 5; r += p + 6; g += p; b -= 6; break; }
            case LAVA: case EMBER: { const p = ((i * 17 + tick * 11) & 15) - 5; r += p + 8; g += p; b -= 4; break; }
            case WATER: { const wg = ((i + (tick >> 2)) & 3) - 1; g += wg; b += wg + 1; break; }
            case STEAM: case CLOUD: { const wp = ((i * 7 + (tick >> 2) * 3) & 3) - 1; r += wp; g += wp; b += wp + 1; break; }
            case RIFT: { const p = ((i * 11 + tick * 6) & 15) - 4; r += p + 8; b += p + 14; break; }
            case AETHER: case AZOTH: { const p = ((i * 19 + tick * 7) & 15) - 4; r += p + (m === AZOTH ? 10 : 0); g += p; b += p + 8; break; }
            case GOLD: { const sp = ((i * 29 + tick * 5) & 15) - 4; r += sp + 10; g += sp + 4; b -= 4; break; }
            case MINNOW: { const d = ((i * 11 + (tick >> 1) * 5) & 7) - 3; g += d + 4; b += d + 6; break; }
            case BLOOM: { const p = ((i * 17 + tick * 3) & 15) - 4; r += p + 8; b += p; break; }
            case ACID: { const st = ((i + tick * 2) & 7) - 3; g += st + 4; r += st; break; }
            case VISITOR: case ICHOR: case RELIC: { const p = ((i * 23 + tick * 9) & 15) - 6; g += p + 6; b += p >> 1; break; }
            case PLASMA: { const p = ((i * 7 + tick * 17) & 31); r += p - 10; g += p - 8; break; }
          }
        }
        if (m === TNT && ((x + y) & 2) === 0) { r = 236; g = 214; b = 168; }
        if (m === MITE) { if (s >= 64) { r += 36; g += 18; b -= 8; } else if (s <= -40) { r += 22; g += 10; b += 4; } }
        if (m === VISITOR && s >= 64) { r = (r + 240) >> 1; g = (g + 190) >> 1; b = b >> 1; }
        if (t > 64 && m !== FIRE && m !== LAVA && m !== EMBER && m !== PLASMA) { const q = (t - 64) >> 3; r += q; b -= q >> 1; }
        const top = y === 0 || cells[i - W] === AIR;
        if (top) {
          if (m === PEARL) { r += 24; g += 20; b += 16; }
          else if (m === MERCURY || m === RELIC) { r += 28; g += 28; b += 24; }
          else if (m === GLASS || m === CRYSTAL || m === AZOTH) { r += 22; g += 18; b += 16; }
        }
        r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
        color[o] = r; color[o + 1] = g; color[o + 2] = b; color[o + 3] = m;
        let f = EMF[m];
        if (f) {
          if (tick !== 0 && m === FIRE) f = 200 + ((i * 7 + tick * 13) & 55);
          emis[o] = (r * f) >> 8; emis[o + 1] = (g * f) >> 8; emis[o + 2] = (b * f) >> 8;
        } else if (t > 120) {
          const e = (t - 120) >> 1; emis[o] = e; emis[o + 1] = e >> 2; emis[o + 2] = 0;
        } else { emis[o] = 0; emis[o + 1] = 0; emis[o + 2] = 0; }
        const k = KIND[m];
        fx[o] = (k !== K_GAS && m !== FIRE && m !== PLASMA) ? 255 : 0;
        fx[o + 1] = m === CLOUD ? 235 : m === STEAM ? 170 : m === AETHER ? 110 : 0;
        fx[o + 2] = k === K_LIQUID ? 255 : 0;
        fx[o + 3] = m === SMOKE ? 255 : 0;
      }
    }
  }
  const COUNTS = new Uint32Array(64);
  function census() {
    COUNTS.fill(0); let gx = 0, gy = 0;
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) { const m = cells[row + x]; COUNTS[m]++; if (m === GOLD) { gx += x; gy += y; } }
    }
    goldCount = COUNTS[GOLD]; visitorCount = COUNTS[VISITOR];
    if (goldCount) { goldCX = gx / goldCount; goldCY = gy / goldCount; }
  }


  function applyOperation(op) {
    switch (op.t) {
      case 'l': flingPre(Math.min(op.x0, op.x1) - op.r, Math.min(op.y0, op.y1) - op.r, Math.max(op.x0, op.x1) + op.r, Math.max(op.y0, op.y1) + op.r, op.m); paintLine(op.x0, op.y0, op.x1, op.y1, op.r, op.m); flingCells(Math.min(op.x0, op.x1) - op.r, Math.min(op.y0, op.y1) - op.r, Math.max(op.x0, op.x1) + op.r, Math.max(op.y0, op.y1) + op.r, op.m, op.vx, op.vy); break;
      case 'p': flingPre(op.x - op.r, op.y - op.r, op.x + op.r, op.y + op.r, op.m); paint(op.x, op.y, op.r, op.m); flingCells(op.x - op.r, op.y - op.r, op.x + op.r, op.y + op.r, op.m, op.vx, op.vy); break;
      case 'spray': flingPre(op.x - op.r, op.y - op.r, op.x + op.r, op.y + op.r, op.m); spray(op.x, op.y, op.r, op.m, op.n); flingCells(op.x - op.r, op.y - op.r, op.x + op.r, op.y + op.r, op.m, op.vx, op.vy); break;
      case 'box': fill(Math.max(0, Math.min(op.x0, op.x1)), Math.max(0, Math.min(op.y0, op.y1)), Math.min(W - 1, Math.max(op.x0, op.x1)), Math.min(H - 1, Math.max(op.y0, op.y1)), op.m); break;
      case 'heat': heatWand(op.x, op.y, op.r, true); break;
      case 'cool': heatWand(op.x, op.y, op.r, false); break;
      case 'rain': rainFromCeiling(op.m, op.n); break;
      case 'tempest': startStorm(); break;
      case 'spark': setc(op.x, op.y, EMBER, grain(EMBER)); break;
      case 'clear': dropSparks(); clearGrid(); break;
      case 'reset': clearGrid(); seedVessel(false); break;
      case 'wipe': {
        const sc = cells.slice(), ss = shades.slice(), sh = heat.slice();
        dropSparks(); clearGrid(); if (op.mode === 'reset') seedVessel(); else if (op.cells) { cells.set(op.cells); for (let i = 0; i < N; i++) shades[i] = grain(cells[i]); }
        wipeC = cells.slice(); wipeS = shades.slice();
        cells.set(sc); shades.set(ss); heat.set(sh); wipe = 0;
        if (op.mode !== 'clear' && ship.active) { ship.active = false; shipCd = 600; }
        break;
      }
      case 'load': { dropSparks(); clearGrid(); cells.set(op.cells); for (let i = 0; i < N; i++) { shades[i] = grain(cells[i]); heat[i] = SEEDHEAT[cells[i]]; } break; }
      case 'snap': return { cells: cells.slice() };
    }
  }
  function advanceWipe() {
    if (wipe >= 0) {
      dirty.fill(1);
      const end = Math.min(W, wipe + 14);
      for (let y = 0; y < H; y++) for (let x = wipe; x < end; x++) {
        const i = y * W + x; cells[i] = wipeC[i]; shades[i] = wipeS[i]; heat[i] = SEEDHEAT[cells[i]]; VX[i] = 0; VY[i] = 0; trails[i] = 0;
      }
      wipe = end >= W ? -1 : end;
    }
  }
  // One-based command ticks: capture is after tickIndex commits and before its successor.
  // Validate and detach the complete incoming batch before replacing the owned queue.
  function advanceTicks(count, incoming = [], onOperation) {
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(tickIndex + count)) throw new Error('Invalid tick count');
    const detached = validateCommands(incoming, tickIndex);
    const keys = new Set(commands.map(command => `${command.tick}:${command.sequence}`));
    for (const command of detached) {
      const key = `${command.tick}:${command.sequence}`;
      if (keys.has(key)) throw new Error('Duplicate command sequence at tick');
      keys.add(key);
    }
    if (detached.length) {
      const nextCommands = [...commands, ...detached].sort((a, b) => a.tick - b.tick || a.sequence - b.sequence);
      validateCheckpointSize({ format: 'alembic-world', version: 1, width: W, height: H, tick: tickIndex,
        state: { ...stateView(), commands: nextCommands } });
      commands = nextCommands;
    }
    const events = [];
    for (let i = 0; i < count; i++) {
      EV.length = 0; blastKick = 0;
      const nextTick = tickIndex + 1;
      opTick = nextTick;
      while (commands.length && commands[0].tick === nextTick) {
        const command = commands.shift();
        const result = applyOperation(command.op);
        onOperation?.(command.op, result);
      }
      simulate();
      advanceWipe();
      flash *= 0.84; if (flash < 0.01) flash = 0;
      if (nextTick % 6 === 0) {
        census();
        if (storm <= 0 && stormCd <= 0 && COUNTS[STEAM] + COUNTS[CLOUD] >= 320) startStorm();
        if (!ship.active && shipCd <= 0 && goldCount >= 200) shipArrive();
      }
      // First ambient ember at 45 simulated seconds; new grain moves next tick.
      if (nextTick % 2700 === 0) rainFromCeiling(EMBER, 1);
      tickIndex = nextTick;
      events.push(...EV.map(event => ({ ...event })));
    }
    return events;
  }
  function step() { return advanceTicks(1); }
  // Explicit edits are permitted while paused; an empty poll never clears pending output.
  function applyOperations(ops, onOperation, reconcileNextTick = false) {
    const detached = validateOperations(ops);
    if (!detached.length) return [];
    // An explicit paused edit is an ordering barrier for previously received next-tick input.
    // Empty polls leave scheduled work alone, and no simulation/environment clock advances here.
    const ready = reconcileNextTick ? commands.filter(command => command.tick === tickIndex + 1) : [];
    if (ready.length) commands = commands.filter(command => command.tick !== tickIndex + 1);
    EV.length = 0; blastKick = 0; opTick = tickIndex + 1;
    for (const op of [...ready.map(command => command.op), ...detached]) {
      const result = applyOperation(op);
      onOperation?.(op, result);
    }
    return EV.map(event => ({ ...event }));
  }
  function commandsForNextTick(ops) {
    const tick = tickIndex + 1;
    const sequence = commands.reduce((next, command) => command.tick === tick ? Math.max(next, command.sequence + 1) : next, 0);
    return ops.map((op, i) => ({ tick, sequence: sequence + i, op }));
  }
  // Presentation census is observational; it must not update persisted targeting caches.
  function finishFrame(censusDue) {
    let seen = null, counts = null;
    if (censusDue) {
      counts = new Array(COUNT).fill(0);
      for (const m of cells) counts[m]++;
      seen = []; for (let m = 0; m < COUNT; m++) if (counts[m]) seen.push(m);
    }
    return {
      kick: blastKick, seen, counts, events: EV.map(event => ({ ...event })),
      ship: ship.active ? { x: ship.x, y: ship.y, beam: ship.beam ? 1 : 0 } : null,
      flash, wipe, wind: windEnergy, storm: storm > 0,
    };
  }
  function reset({ seed: nextSeed = initialSeed, scene: nextScene = initialScene } = {}) {
    if (nextScene !== 'empty' && nextScene !== 'vessel') throw new Error(`Unknown scene: ${nextScene}`);
    initialSeed = nextSeed >>> 0; initialScene = nextScene;
    random.reset(initialSeed);
    clearGrid();
    for (const a of [born, heatOut, trailOut, meltList, PRE, WU, WV, WU0, WV0, WP, WP2, WD, HS, SOL, WS, AX, AY, BX, BY, SX, SY, SS, COUNTS]) a.fill(0);
    dirty.fill(1); awake.fill(1); live.fill(0); tQuiet.fill(0);
    scanDir = 1; blastKick = 0; windEnergy = 0; tickIndex = 0; EV.length = 0;
    commands = []; opTick = 0;
    Object.assign(ship, { active: false, x: 0, y: 24, t: 0, leaving: false, spawnCd: 0, stolen: 0, crash: false, beam: false });
    shipCd = 0; storm = 0; stormT = 0; stormCd = 0; boltCd = 60; flash = 0;
    goldCount = 0; goldCX = W / 2; goldCY = H / 2; visitorCount = 0;
    PBX = 0; PBY = 0; sHeat = false; sFood = -1; sFoodIchor = false; sGold = -1; sMud = -1; sKin = 0; sVis = false;
    wipe = -1; wipeC = null; wipeS = null;
    if (nextScene === 'vessel') seedVessel();
  }
  // Private view for size preflight: no grid/queue copies are needed to count serialized bytes.
  function stateView() {
    return {
      seed: initialSeed, scene: initialScene, tickIndex,
      cells, shades, heat, VX, VY, trails, WU, WV,
      scanDir, trailsLive, blastKick, windEnergy, ship,
      shipCd, storm, stormT, stormCd, boltCd, flash, goldCount, goldCX, goldCY, visitorCount,
      wipe, wipeC, wipeS, events: EV, random: random.captureState(), commands, dirty,
    };
  }
  function captureState() {
    // Authoritative: attached grain payloads, spatial fields, clocks, stale census targets,
    // pending commands/wipe targets/events, and all PRNG states. No live references escape here.
    return structuredClone(stateView());
  }
  function restore(state) {
    // Every possible validation/allocation failure happens before changing live state.
    const next = validateWorldState(state);
    initialSeed = next.seed; initialScene = next.scene; tickIndex = next.tickIndex;
    cells.set(next.cells); shades.set(next.shades); heat.set(next.heat);
    VX.set(next.VX); VY.set(next.VY); trails.set(next.trails); WU.set(next.WU); WV.set(next.WV);
    scanDir = next.scanDir; trailsLive = next.trailsLive; blastKick = next.blastKick; windEnergy = next.windEnergy;
    ship.active = next.ship.active; ship.x = next.ship.x; ship.y = next.ship.y; ship.t = next.ship.t;
    ship.leaving = next.ship.leaving; ship.spawnCd = next.ship.spawnCd; ship.stolen = next.ship.stolen;
    ship.crash = next.ship.crash; ship.beam = next.ship.beam;
    shipCd = next.shipCd; storm = next.storm; stormT = next.stormT; stormCd = next.stormCd;
    boltCd = next.boltCd; flash = next.flash; goldCount = next.goldCount;
    goldCX = next.goldCX; goldCY = next.goldCY; visitorCount = next.visitorCount;
    wipe = next.wipe; wipeC = next.wipeC; wipeS = next.wipeS; commands = next.commands;
    // Checkpoints from before sleeping chunks wake the whole vessel for one tick.
    if (next.dirty) dirty.set(next.dirty); else dirty.fill(1);
    tQuiet.fill(0);
    EV.length = 0; for (const event of next.events) EV.push(event);
    random.physical.reset(next.random.physical); random.ecology.reset(next.random.ecology);
    random.weather.reset(next.random.weather); random.cosmetic.reset(next.random.cosmetic);
  }
  function inspect() {
    return {
      cells, shades, heat, trails, VX, VY, born, WU, WV, awake, dirty, W, H, step, setc, get, paint, paintLine, detonate,
      clear: clearGrid, seed: n => random.reset(n), DENS, KIND, DISP, G, MAXV,
      // Scratch is rebuilt before being read on the next tick/operation: born, heatOut,
      // trailOut, meltList, PRE, WU0/WV0, WP/WP2/WD, HS/SOL/WS, neighbor/sense scratch.
      scratch: { heatOut, trailOut, meltList, PRE, WU0, WV0, WP, WP2, WD, HS, SOL, WS, AX, AY, BX, BY, SX, SY, SS, COUNTS },
    };
  }
  reset({ seed, scene });
  return { step, advanceTicks, applyOperation, applyOperations, commandsForNextTick,
    captureState, restore, reset, render: blit, inspect, finishFrame };
}

// Every test/bench receives hooks for one new world; there is no shared simulation.
export function createTestWorld(options = {}) { return createWorld({ scene: 'empty', ...options }).inspect(); }
