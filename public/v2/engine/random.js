// Mulberry32 with explicit state. Integer seeds retain the v2 physical sequence.
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  return {
    int: n => n <= 0 ? 0 : next() % n,
    float: () => next() / 4294967296,
    captureState: () => state,
    reset(n) { state = n >>> 0; },
  };
}

// Fixed salts separate subsystem sequences; no stream consumes another's draws.
const SALTS = { physical: 0, ecology: 0x9e3779b9, weather: 0x243f6a88, cosmetic: 0xb7e15162 };
export function createRandomStreams(seed) {
  const streams = Object.fromEntries(Object.entries(SALTS).map(([name, salt]) => [name, createRandom(seed ^ salt)]));
  return {
    ...streams,
    reset(n) { for (const [name, salt] of Object.entries(SALTS)) streams[name].reset(n ^ salt); },
    captureState() { return Object.fromEntries(Object.entries(streams).map(([name, stream]) => [name, stream.captureState()])); },
  };
}
