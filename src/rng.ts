/** Seedable 32-bit PRNG shared by paint shade and diagonal choice. */
let state = 0xa341316c;

export function seedRng(seed: number): void {
  state = seed >>> 0;
  if (state === 0) state = 1;
}

export function randU32(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

export function randInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return randU32() % maxExclusive;
}

export function randShade(amplitude: number): number {
  if (amplitude <= 0) return 0;
  return randInt(amplitude * 2 + 1) - amplitude;
}
