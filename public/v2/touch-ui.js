// Floating touch chrome: families, the radial orb, the sheet snap, and idle hide.
// None of this runs from the frame loop. Idle hide is a timer armed when the fingers lift.
import {
  AIR, KIND, PLANT, SEED, MOSS, WOOD, MITE, MINNOW, BLOOM, FUNGUS, SPORE, FIREFLY, CORAL, BEETLE, NEWT,
  FIRE, LAVA, EMBER, TNT, NITRO, NAPALM, C4, FUSE, PLASMA,
} from './engine/world.js';

export const IDLE_MS = 3000;
export const HOLD_MS = 380;
export const HOLD_MOVE = 12;
export const RECENT_SLOTS = 3;
export const PICKER_SLOTS = 8;
const LIFE = new Set([PLANT, SEED, MOSS, WOOD, MITE, MINNOW, BLOOM, FUNGUS, SPORE, FIREFLY, CORAL, BEETLE, NEWT]);
const BLAZE = new Set([FIRE, LAVA, EMBER, TNT, NITRO, NAPALM, C4, FUSE, PLASMA]);
const FAMILY_BY_KIND = ['stone', 'powders', 'liquids', 'gases'];

export const FAMILY_ORDER = Object.freeze([
  ['powders', 'Powders'],
  ['liquids', 'Liquids'],
  ['life', 'Life'],
  ['fire', 'Fire'],
  ['stone', 'Stone'],
  ['gases', 'Gases'],
]);

export function familyOf(id) {
  if (LIFE.has(id)) return 'life';
  if (BLAZE.has(id)) return 'fire';
  if (id === AIR) return 'gases';
  return FAMILY_BY_KIND[KIND[id]] || 'stone';
}

export function groupKnown(ids, names, query) {
  const q = String(query || '').trim().toLowerCase();
  const buckets = new Map(FAMILY_ORDER.map(([key, label]) => [key, { key, label, ids: [] }]));
  for (const id of ids) {
    const name = names[id] || '';
    if (q && !name.toLowerCase().includes(q)) continue;
    const bucket = buckets.get(familyOf(id));
    if (bucket) bucket.ids.push(id);
  }
  return [...buckets.values()].filter(group => group.ids.length);
}

export function rememberRecent(history, id, limit = 8) {
  return [id, ...(history || []).filter(other => other !== id)].slice(0, limit);
}

export function recentAround(history, current, fallback, limit = RECENT_SLOTS) {
  const out = [];
  const push = id => { if (id !== current && !out.includes(id)) out.push(id); };
  for (const id of history || []) push(id);
  for (const id of fallback || []) push(id);
  return out.slice(0, limit);
}

export function pickerIds(known, current, history, starters, limit = PICKER_SLOTS) {
  const has = id => (known && typeof known.has === 'function' ? known.has(id) : (known || []).includes(id));
  const out = [];
  const push = id => { if (id === current || !has(id) || out.includes(id)) return; out.push(id); };
  for (const id of history || []) push(id);
  for (const id of starters || []) push(id);
  if (known && typeof known[Symbol.iterator] === 'function') for (const id of known) push(id);
  return out.slice(0, limit);
}

// The orb sits in the left thumb's corner, so the fan runs from straight up to
// up-right. A slot that reaches left of the orb falls off the screen.
const FAN_START = Math.PI * 0.5;
const FAN_END = Math.PI * 0.16;

export function arcSlots(count, radius = 78, start = FAN_START, end = FAN_END) {
  if (count <= 0) return [];
  const slots = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = start + (end - start) * t;
    slots.push({ x: Math.cos(angle) * radius, y: -Math.sin(angle) * radius });
  }
  return slots;
}

// Radius that keeps `count` slots about `gap` px apart inside the fan.
export function fanRadius(count, gap = 46) {
  const span = FAN_START - FAN_END;
  if (count <= 1) return 96;
  return Math.max(96, Math.ceil(((count - 1) * gap) / span));
}

export function placeSlot(slot, origin, size) {
  const half = size / 2;
  return { left: origin.x + slot.x - half, bottom: origin.y - slot.y - half };
}

export function nearestSlot(dx, dy, slots, maxDist) {
  let best = -1;
  let bestD = maxDist;
  for (let i = 0; i < (slots || []).length; i++) {
    const d = Math.hypot(dx - slots[i].x, dy - slots[i].y);
    if (d <= bestD) { best = i; bestD = d; }
  }
  return best;
}

// dy is downward. A short drag stays put; a long drag steps one stop or closes.
export function nextSnap(snap, dy) {
  if (dy <= -56) return 'full';
  if (dy >= 56) return snap === 'full' ? 'half' : 'closed';
  return snap === 'full' || snap === 'half' ? snap : 'half';
}

export function createIdleChrome({ idleMs = IDLE_MS, start = true, onChange, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = clearTimeout } = {}) {
  let pointers = 0;
  let timer = 0;
  let idle = false;
  const clear = () => { if (timer) { clearTimer(timer); timer = 0; } };
  const show = () => {
    clear();
    if (idle) { idle = false; onChange(false); }
  };
  const arm = () => {
    clear();
    timer = setTimer(() => { timer = 0; idle = true; onChange(true); }, idleMs);
  };
  if (start) arm();
  return {
    down() { pointers += 1; show(); },
    up() { pointers = Math.max(0, pointers - 1); if (pointers === 0) arm(); },
    nudge() { show(); if (pointers === 0) arm(); },
    stop() { clear(); pointers = 0; },
    get idle() { return idle; },
  };
}
