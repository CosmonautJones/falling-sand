// One gentle suggestion for a newcomer: the first nearby transmutation they have not made yet.
// Names are engine export names, so this module needs no engine import.
export const NUDGES = Object.freeze([
  { goal: 'BRINE', brush: 'SALT', text: 'Pour salt into the trough of water.' },
  { goal: 'POWDER', brush: 'SALT', text: 'Sprinkle salt over the ash the casks left.' },
  { goal: 'BRICK', brush: 'FIRE', text: 'Bake a little mud with fire.' },
  { goal: 'CRYSTAL', brush: 'FIRE', text: 'Set fire to brine and see what it keeps.' },
  { goal: 'MERCURY', brush: 'ACID', text: 'Drip acid onto the lead on the stone table.' },
  { goal: 'BLOOM', brush: 'WATER', text: 'Keep watering the plants until the thicket opens.' },
  { goal: 'NITRO', brush: 'OIL', text: 'Let a fuse of salt and ash soak in oil.' },
  { goal: 'GOLD', brush: 'LEAD', text: 'Roast lead beside mercury in the fire.' },
]);

export function pickNudge(known, ids) {
  for (const n of NUDGES) if (!known.has(ids[n.goal])) return { goal: ids[n.goal], brush: ids[n.brush], text: n.text };
  return null;
}
