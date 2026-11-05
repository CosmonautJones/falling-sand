export const INTENTIONS = {
  observe: {
    prompt: 'Pick a place, make one change, and see what comes back next season.',
    reading: (s) => `${s.livingPatches} rooted patches · ${s.soilWater} stored soil water`,
  },
  wetland: {
    prompt: 'Dig a shallow pocket or build a stone lip to hold floodwater. Watch for reeds along the waterline.',
    reading: (s) => `${s.reeds} reed patches · ${s.wetPatches} patches holding water`,
  },
  refuge: {
    prompt: 'Give roots a place to ride out Dry. Compare the same plants before and after, then change where water collects.',
    reading: (s) => `${s.livingPatches} rooted patches · ${s.soilWater} stored soil water`,
  },
  renewal: {
    prompt: 'Burn a small green patch and leave its neighbour alone. Watch what grows when water returns.',
    reading: (s) => `${s.burnedPatches} fire scars · ${s.flowers} fireflower patches`,
  },
};

export const SEASON_NOTES = {
  rain: 'Rain wets exposed ground. Shape places for the water to stay.',
  dry: 'Sunlit soil dries faster. Watch the roots along pools and shaded edges.',
  recovery: 'Light showers return. Wet ground and fire scars can grow different plants.',
};

export function createFieldJournal() {
  let previous, dry;
  const entries = [], discoveries = new Set();

  function observe(stats, plants) {
    const season = stats.season;
    const time = `Year ${season.year} · ${season.name}`;
    let changed = false;
    function add(title, text) {
      entries.unshift({ time, title, text });
      if (entries.length > 8) entries.pop();
      changed = true;
    }
    if (!previous || previous.season.id !== season.id || previous.season.year !== season.year) {
      if (dry && previous?.season.id === 'dry') {
        const alive = new Set(plants.filter(Boolean));
        const survived = dry.roots.filter((root) => alive.has(root)).length;
        const start = dry.full ? 'at the start of Dry' : 'when this observation began';
        const roots = dry.roots.length
          ? `${survived} of ${dry.roots.length} plants present ${start} are still rooted.`
          : 'There were no rooted plants at the start of this observation.';
        add('After the dry spell', `${roots} Stored soil water: ${dry.water} → ${stats.soilWater}.`);
        dry = undefined;
      }
      if (season.id === 'dry') {
        dry = { roots: plants.filter(Boolean), water: stats.soilWater, full: season.elapsed === 0 };
      }
      add(previous ? `${season.name} begins` : 'A fresh observation', SEASON_NOTES[season.id]);
    }
    for (const [name, count, title, text] of [
      ['reed', stats.reeds, 'First reeds', 'Reeds established where roots had standing water or very wet soil.'],
      ['fire', stats.burnedPatches, 'The soil remembers fire', 'A burn scar changes which plants can take root there next.'],
      ['fireflower', stats.flowers, 'A fireflower returns', 'A seed found enough water and light on recently burned ground.'],
    ]) {
      if (count > 0 && !discoveries.has(name)) {
        discoveries.add(name);
        add(title, text);
      }
    }
    previous = stats;
    return changed;
  }
  return { observe, entries };
}
