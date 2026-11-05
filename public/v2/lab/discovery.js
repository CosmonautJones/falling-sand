import * as E from '../engine/world.js';

export const JOURNAL_KEY = 'alembic-lab-discoveries-v1', LEGACY_KEY = 'alembic-discovered-v2';
export const MILESTONES = [
  { id: 'garden', name: 'A little world', requires: [E.PLANT, E.MUD], rewards: [E.MINNOW], hint: 'Give a seed water, then slake the grey remains of fire.' },
  { id: 'kiln', name: 'Keeper of the kiln', requires: [E.GLASS, E.BRICK], rewards: [E.COPPER, E.STEEL, E.TUNGSTEN], hint: 'Teach sand to see and wet earth to stand.' },
  { id: 'thermal', name: 'Across the thermal divide', requires: [E.STEAM, E.OBSIDIAN], rewards: [E.LIQUID_NITROGEN], hint: 'Lift water as a ghost; quench molten rock to night.' },
  { id: 'magnetic', name: 'An invisible invitation', requires: [E.CRYSTAL, E.GOLD], rewards: [E.MAGNET, E.FERROFLUID], hint: 'Keep salt’s violet bone and finish the heavy king.' },
  { id: 'sky', name: 'Lighter than the sky', requires: [E.AETHER], rewards: [E.HELIUM, E.AEROGEL], hint: 'Let steam meet a violet bone and forget its weight.' },
];
export const EXPERIMENTS = [
  { goal: E.BRINE, brush: E.SALT, requires: [E.WATER], text: 'Pour a little water, then sprinkle salt into it.' },
  { goal: E.GLASS, brush: E.FIRE, requires: [E.SAND], text: 'Lay down sand and touch it with fire. Watch for a grain that stays behind.' },
  { goal: E.PLANT, brush: E.SEED, requires: [E.WATER], text: 'Drop a seed at the edge of a small pool.' },
  { goal: E.ASH, brush: E.FIRE, requires: [], text: 'Give a small flame no fuel. See what its short life leaves.' },
  { goal: E.MUD, brush: E.WATER, requires: [E.ASH], text: 'Pour water onto the ash left by a fire.' },
  { goal: E.BRICK, brush: E.FIRE, requires: [E.MUD], text: 'Bake a little mud with fire.' },
  { goal: E.STEAM, brush: E.FIRE, requires: [E.WATER], text: 'Touch fire to water and watch the space above it.' },
  { goal: E.OBSIDIAN, brush: E.WATER, requires: [E.LAVA], text: 'Quench a small pool of lava with water.' },
  { goal: E.NITROGEN, brush: E.LIQUID_NITROGEN, requires: [E.LIQUID_NITROGEN], text: 'Pour your cryogenic supply beside water. Its cold spill will become a gas.' },
  { goal: E.CRYSTAL, brush: E.FIRE, requires: [E.BRINE], text: 'Heat brine with fire and see what the salt keeps.' },
  { goal: E.MERCURY, brush: E.ACID, requires: [E.LEAD], text: 'Drip acid onto a few grains of lead.' },
  { goal: E.GOLD, brush: E.LEAD, requires: [E.MERCURY, E.FIRE], text: 'Bring lead, mercury and fire together.' },
  { goal: E.AETHER, brush: E.STEAM, requires: [E.STEAM, E.CRYSTAL], text: 'Let steam brush against crystal.' },
  { goal: E.AZOTH, brush: E.AETHER, requires: [E.AETHER, E.GOLD, E.CRYSTAL], text: 'Gather gold and crystal, then let aether find them.' },
  { goal: E.POWDER, brush: E.SALT, requires: [E.ASH], text: 'Sprinkle salt over ash.' },
  { goal: E.NITRO, brush: E.OIL, requires: [E.POWDER], text: 'Let oil soak into powder.' },
  { goal: E.CRYO, brush: E.AETHER, requires: [E.AETHER, E.ICE], text: 'Give aether something cold to touch.' },
  { goal: E.PEARL, brush: E.MINNOW, requires: [E.MINNOW, E.CRYSTAL, E.WATER], text: 'Keep a minnow in water beside crystal, and give it time.' },
  { goal: E.FONT, brush: E.AETHER, requires: [E.AETHER, E.PEARL], text: 'Let aether find the moon a minnow left behind.' },
];
const validId = m => Number.isInteger(m) && m > 0 && m < E.COUNT;
const ids = values => Array.isArray(values) ? values.slice(0, E.COUNT * 2).filter(validId) : [];
const labNotes = {
  [E.STONE]: 'A foundation. Structures touching a vessel edge stay anchored; cut one free and gravity takes it. Acid prospects stone for lead, rarely gold. Moss wants it wet.',
  [E.GLASS]: 'A rigid, transparent material. Detached structures fall with gravity. Heat crawls through it slowly; build cups to keep lava.',
  [E.BRICK]: 'Mud baked by fire. A rigid building material that falls when its supports are cut. A kiln in miniature.',
  [E.PEARL]: 'A minnow’s gift beside crystal. A rift will not drink it. Aether may teach it to give something back forever.',
  [E.MERCURY]: 'A living silver. Next to lead and fire it crowns the king.',
  [E.GOLD]: 'Heavy powder, a spark in the light. A column six high, kissed by aether at the tip, strikes fire at the base. Mites will steal a grain and walk the colour of the king.',
  [E.AETHER]: 'Lighter than steam. On gold and crystal it coagulates as azoth. On a gold rod it is lightning.',
  [E.VOID]: 'Fire boxed in eight obsidian. It spreads through living stuff as more void. Azoth keeps it back.',
  [E.CLOUD]: 'When enough steam gathers, the ceiling darkens. Clouds drift on the draft, rain, and strike.',
  [E.FONT]: 'Aether found a pearl. It learns the first suitable material that touches it and gives it back: a well, a spout, a torch.',
  [E.COPPER]: 'A rigid conductor. Heat travels through it quickly. Bridge a hot chamber and a cold one; cut it free to let gravity move the assembly.',
  [E.STEEL]: 'Dense structural metal for vessels, frames and scaffolding. Assemblies touching the vessel edge are anchored; disconnected ones fall.',
  [E.MAGNET]: 'An invisible hand for ferrofluid. Distance weakens its bounded pull. Anchor a magnet to a vessel edge, or let its assembly fall.',
};
export function pageFor(m) {
  const page = E.PAGES[m];
  return { w: m === E.STONE ? 'A foundation, until you free it.' : page.w, l: labNotes[m] || page.l };
}

export function hintFor(m) {
  const milestone = MILESTONES.find(item => item.rewards.includes(m));
  if (milestone) return `A research supply. ${milestone.hint}`;
  if (m === E.NITROGEN) return 'What a cold spill exhales.';
  return E.HINTS[m] || 'An unwritten page. Keep experimenting.';
}
function refresh(state) {
  const awards = [];
  for (const milestone of MILESTONES) if (milestone.requires.every(m => state.known.has(m))) {
    if (!state.completed.has(milestone.id)) awards.push(milestone);
    state.completed.add(milestone.id);
    for (const m of milestone.rewards) { state.known.add(m); state.supplied.add(m); }
  }
  state.next = EXPERIMENTS.find(item => !state.known.has(item.goal) && state.known.has(item.brush) && item.requires.every(m => state.known.has(m))) || null;
  return awards;
}
export function createProgress(saved, legacy = []) {
  const data = saved?.format === 'alembic-lab-discoveries' && saved.version === 1 ? saved : {};
  const inherited = new Set([...ids(data.inherited), ...ids(legacy)]);
  const made = new Set(ids(data.made));
  const state = { known: new Set([...ids(E.STARTER), ...ids(data.known), ...inherited, ...made]), made, inherited,
    supplied: new Set(), completed: new Set(), mode: data.mode === 'workshop' ? 'workshop' : 'discovery', next: null };
  refresh(state);
  return state;
}
export function reveal(state, records) {
  const found = []; let changed = false;
  for (const record of records) {
    const m = record?.m; if (!validId(m)) continue;
    if (!state.known.has(m)) { state.known.add(m); found.push(record); changed = true; }
    if (!state.made.has(m)) { state.made.add(m); changed = true; }
  }
  const awards = refresh(state);
  return { found, awards, changed: changed || awards.length > 0 };
}
export function canPour(state, m) { return validId(m) && (state.mode === 'workshop' || state.known.has(m)); }
export function setAccess(state, mode) {
  if (mode !== 'discovery' && mode !== 'workshop') throw new Error('Unknown material access mode');
  state.mode = mode;
}
export function serializeProgress(state) {
  return { format: 'alembic-lab-discoveries', version: 1, known: [...state.known], made: [...state.made], inherited: [...state.inherited], mode: state.mode };
}
export function mergeProgress(state, other) {
  let changed = false;
  for (const key of ['known', 'made', 'inherited']) for (const m of other[key]) if (!state[key].has(m)) { state[key].add(m); changed = true; }
  refresh(state);
  return changed;
}
export function readProgress(storage) {
  let unavailable = false;
  function read(key) {
    try { const raw = storage.getItem(key); if (!raw) return null; if (raw.length > 20000) throw new Error('Oversized journal'); return JSON.parse(raw); }
    catch { unavailable = true; return null; }
  }
  const saved = read(JOURNAL_KEY), legacy = read(LEGACY_KEY);
  return { state: createProgress(saved, legacy), unavailable };
}
export function saveProgress(storage, state) {
  try {
    mergeProgress(state, readProgress(storage).state);
    storage.setItem(JOURNAL_KEY, JSON.stringify(serializeProgress(state)));
    return true;
  } catch { return false; }
}
