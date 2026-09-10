import { Material, STARTER, TRANSMUTED, type MaterialId } from './materials';

export interface Page {
  readonly id: MaterialId;
  readonly whisper: string;
  readonly leaf: string;
}

const PAGES: Record<MaterialId, { whisper: string; leaf: string }> = {
  [Material.Air]: {
    whisper: 'The first emptiness.',
    leaf: 'Grains fall through it. The vessel is a box of this, and every other reagent is an argument against it.',
  },
  [Material.Sand]: {
    whisper: 'The shore in a grain.',
    leaf: 'Falls, slides, dunes. Fire vitrifies it to glass. Resting on brine, it petrifies. A falling band will splash a pool.',
  },
  [Material.Water]: {
    whisper: 'The wet argument.',
    leaf: 'Runs, pools, drowns fire as steam. Ice drinks it. Heat soaks; hot water rises. Seeds and ash wait for it.',
  },
  [Material.Stone]: {
    whisper: 'The floor that will not move.',
    leaf: 'Acid prospects it for lead, rarely gold. Fire licks it toward lava. Moss wants it wet. It conducts heat slowly.',
  },
  [Material.Fire]: {
    whisper: 'A short life, hungry.',
    leaf: 'Eats plant, oil, wood, powder, bloom. Without fuel it keeps ash. Water makes steam. Boxed in eight obsidian it becomes a black sun. An obsidian frame lit with it is a door.',
  },
  [Material.Plant]: {
    whisper: 'Seed drinks. The garden answers.',
    leaf: 'Grows while wet. A thicket drops seed, then opens bloom. Ash is bone-meal. Fire takes it. Mites graze it.',
  },
  [Material.Oil]: {
    whisper: 'A dark float.',
    leaf: 'Rides water. Burns. With powder it waits as nitro. Minnows die in it.',
  },
  [Material.Seed]: {
    whisper: 'A promise with mass.',
    leaf: 'Drinks water or mud and stands as plant. Fire eats the unpromised.',
  },
  [Material.Ash]: {
    whisper: 'Fire without fuel keeps a grey secret.',
    leaf: 'Slakes in water as mud. A dry plant still grows if ash is near. With salt it makes a fuse.',
  },
  [Material.Mud]: {
    whisper: 'Ash slakes. The floor remembers rain.',
    leaf: 'Fire remembers it as brick. A seed will sprout on it. Wet, against plant, it hatches mites.',
  },
  [Material.Glass]: {
    whisper: 'Sand looks upon fire and learns to see.',
    leaf: 'It will not fall. Heat crawls through it slowly. Cups are made of this so lava can be kept.',
  },
  [Material.Moss]: {
    whisper: 'Wet stone grows a quiet pelt.',
    leaf: 'Creeps along stone that drinks. Mites will graze it. Acid and fire do not suffer it.',
  },
  [Material.Ice]: {
    whisper: 'Water, stopped.',
    leaf: 'Freezes neighboring water. Fire and ember thaw it; heat soaks through a wall, then it runs. Steam that kisses it falls as water. Crystal hanging beside it drips.',
  },
  [Material.Wood]: {
    whisper: 'A standing fuel.',
    leaf: 'Fire throws ember from it. It will not slide. The opening casks sit by a little of this.',
  },
  [Material.Salt]: {
    whisper: 'A white thirst.',
    leaf: 'Drinks and becomes brine. With ash, a short black fuse. Acid tamed by it is only water again.',
  },
  [Material.Steam]: {
    whisper: 'Water climbs as a ghost.',
    leaf: 'Rises through air and water. Ice knocks it down. Crystal with it forgets to fall and becomes aether. A cloud against the ceiling rains as dew.',
  },
  [Material.Lava]: {
    whisper: 'Stone that forgot itself.',
    leaf: 'A heat that will not go out. Water and ice quench it to obsidian and steam. Sand becomes glass in its sight.',
  },
  [Material.Ember]: {
    whisper: 'Wood throws a falling star.',
    leaf: 'Falls like powder. Melts ice even in a wet pool, then quenches to steam. Without fuel it cools to ash. The ceiling sometimes remembers one.',
  },
  [Material.Obsidian]: {
    whisper: 'Lava and water argue. Night wins.',
    leaf: 'It holds against blast. Eight around fire make void. A frame of it, inner air at least two by two, lit with fire, is a rift.',
  },
  [Material.Brine]: {
    whisper: 'Salt drinks and will not freeze easily.',
    leaf: 'Heavier water. Sand that settles on it turns to stone. Fire leaves a violet bone: crystal.',
  },
  [Material.Crystal]: {
    whisper: 'Hot brine keeps a violet bone.',
    leaf: 'Hanging over air beside ice or water, it drips. Steam that kisses it becomes aether. A minnow that schools against it sometimes leaves a pearl.',
  },
  [Material.Acid]: {
    whisper: 'A green bite.',
    leaf: 'Lead sheds as mercury. Stone yields sand, sometimes lead, rarely gold. Salt tames it. Living stuff it simply erases.',
  },
  [Material.Lead]: {
    whisper: 'The heavy king, unripe.',
    leaf: 'Acid frees mercury. Mercury, lead, and fire roast it to gold. Azoth finishes that roast without the flame.',
  },
  [Material.Mercury]: {
    whisper: 'Lead sheds its weight. Hermes laughs.',
    leaf: 'A living silver. Next to lead and fire it crowns the king. The word hermes, typed into the dark, rains it.',
  },
  [Material.Gold]: {
    whisper: 'The roast is finished. The king is in the cup.',
    leaf: 'Heavy powder, a spark in the blit. A column six high, kissed by aether at the tip, strikes fire at the base. Mites will steal a grain and walk the colour of the king. Konami still works.',
  },
  [Material.Aether]: {
    whisper: 'Steam kisses crystal and forgets to fall.',
    leaf: 'Lighter than steam. On gold and crystal it coagulates as azoth. On a gold rod it is lightning. Seven strikes on the name rain it.',
  },
  [Material.Azoth]: {
    whisper: 'Solve et coagula. The Work is in the vessel.',
    leaf: 'Gold, aether, and crystal. It turns nearby lead to gold without fire. Void will not eat what stands in its shade. The glass remembers.',
  },
  [Material.Void]: {
    whisper: 'A black sun. It is hungry.',
    leaf: 'Fire boxed in eight obsidian. It spreads through living stuff as more void. Azoth keeps it back. The word nigredo opens a little of it.',
  },
  [Material.Powder]: {
    whisper: 'Salt and ash make a short argument.',
    leaf: 'A fuse. Fire walks it one hop a tick. Oil that drinks it waits as nitro.',
  },
  [Material.Brick]: {
    whisper: 'Mud remembers fire and stands.',
    leaf: 'It will not fall. Heat crawls. A kiln in miniature.',
  },
  [Material.Rift]: {
    whisper: 'A door of night. What falls in forgets its name.',
    leaf: 'An obsidian frame, inner hole at least two by two, lit with fire. What touches it becomes aether. Gold, crystal, stone, and pearl it will not drink.',
  },
  [Material.Tnt]: {
    whisper: 'A red cask. Do not sneeze.',
    leaf: 'Fire, ember, lava, or a burning fuse. Neighbors chain. Sand is thrown. Water boils. Obsidian, azoth, and rifts hold.',
  },
  [Material.Nitro]: {
    whisper: 'Oil drinks powder and waits for a spark.',
    leaf: 'A meaner hole than the red cask. Same spark. Same things hold.',
  },
  [Material.Mite]: {
    whisper: 'A grain with legs. It steals.',
    leaf: 'Camouflaged in sand, it crawls, burrows, and will not swim if it can climb out. Bloom before plant before moss. Heat sends it running; if it dies laden, gold or mud spills. Minnows hunt it at the shore. Gold it only hoards beside more gold. Loose mud it will haul, and set down beside kin or more mud; a nest against plant it will not steal. A huddle mills instead of scattering. They lay a scent empty mites shun and laden mites follow home. Wet mud against plant hatches more.',
  },
  [Material.Minnow]: {
    whisper: 'The trough keeps a silver thought.',
    leaf: 'Schools, darts the meniscus, and swims off heat. Eats a mite — and any seed — that touches the pool; stolen gold is left behind. Oil, lava, fire, acid cook it to ash. Crystal nearby, it sometimes dreams a pearl.',
  },
  [Material.Bloom]: {
    whisper: 'The thicket shows its throat.',
    leaf: 'A wet plant thicket opens this instead of another seed. Mites prefer it. Fire takes it like plant.',
  },
  [Material.Pearl]: {
    whisper: 'A minnow dreamed of crystal and woke with a moon.',
    leaf: 'It will not fall. A rift will not drink it. Keep it.',
  },
};

const ORDER: readonly MaterialId[] = [...STARTER, ...TRANSMUTED];

export function page(id: MaterialId): Page {
  const leaf = PAGES[id];
  return { id, whisper: leaf.whisper, leaf: leaf.leaf };
}

export function whisper(id: MaterialId): string {
  return PAGES[id].whisper;
}

export function stained(known: ReadonlySet<MaterialId>): Page[] {
  const out: Page[] = [];
  for (const id of ORDER) {
    if (known.has(id)) out.push(page(id));
  }
  return out;
}

export function blanks(known: ReadonlySet<MaterialId>): number {
  return Object.values(Material).length - known.size;
}
