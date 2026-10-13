import { TERRAIN_VERSION } from './terrain.js';

export const DEFAULT_SEED = 0xc00c17;
export function parseSeed(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!/^\d{1,10}$/.test(raw) || Number(raw) > 0xffffffff) return null;
  return Number(raw);
}
export function seedFromSearch(search) {
  const params = new URLSearchParams(search),
    parsed = parseSeed(params.get('seed'));
  return {
    seed: parsed ?? DEFAULT_SEED,
    // Original seed links had no terrain version. Keep their starting scenes reproducible.
    terrainVersion:
      parsed !== null && (!params.has('terrain') || params.get('terrain') === '1')
        ? 1
        : TERRAIN_VERSION,
  };
}
export function seedSearch(search, seed, terrainVersion) {
  const params = new URLSearchParams(search);
  params.set('seed', String(seed));
  params.set('terrain', String(terrainVersion));
  return params.toString();
}
export function differentSeed(candidate, current) {
  return candidate === current ? (current + 1) >>> 0 : candidate;
}
