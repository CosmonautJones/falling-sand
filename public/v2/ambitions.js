// Optional named challenges. No score: each is met or not, judged from the live census.
// `c` is the per-material count array; `M` is the engine module (material ids by name).
export const AMBITIONS = Object.freeze([
  { key: 'school', name: 'A Proper School', desc: 'Keep twenty minnows alive at once.', done: (c, M) => c[M.MINNOW] >= 20 },
  { key: 'hive', name: 'The Hive', desc: 'Let a hundred mites swarm the vessel.', done: (c, M) => c[M.MITE] >= 100 },
  { key: 'reef', name: 'Reef', desc: 'Grow four hundred grains of coral.', done: (c, M) => c[M.CORAL] >= 400 },
  { key: 'meadow', name: 'Meadow', desc: 'A thousand plants and forty blooms, together.', done: (c, M) => c[M.PLANT] >= 1000 && c[M.BLOOM] >= 40 },
  { key: 'winter', name: 'Winter', desc: 'Pile up two thousand grains of snow.', done: (c, M) => c[M.SNOW] >= 2000 },
  { key: 'jar', name: 'Honey Jar', desc: 'Hold honey and amber in the same vessel.', done: (c, M) => c[M.HONEY] >= 30 && c[M.AMBER] >= 30 },
  { key: 'lanterns', name: 'Lanterns', desc: 'Keep thirty fireflies aloft.', done: (c, M) => c[M.FIREFLY] >= 30 },
  { key: 'treasury', name: 'Treasury', desc: 'Hoard a thousand grains of gold.', done: (c, M) => c[M.GOLD] >= 1000 },
]);

export function checkAmbitions(counts, M, done) {
  const met = [];
  for (const a of AMBITIONS) if (!done.has(a.key) && a.done(counts, M)) met.push(a.key);
  return met;
}
