export const Material = {
  Air: 0,
  Sand: 1,
  Water: 2,
  Stone: 3,
  Fire: 4,
  Plant: 5,
  Oil: 6,
  Seed: 7,
  Ash: 8,
  Mud: 9,
  Glass: 10,
  Moss: 11,
  Ice: 12,
  Wood: 13,
  Salt: 14,
  Steam: 15,
  Lava: 16,
  Ember: 17,
  Obsidian: 18,
  Brine: 19,
  Crystal: 20,
  Acid: 21,
  Lead: 22,
  Mercury: 23,
  Gold: 24,
  Aether: 25,
  Azoth: 26,
  Void: 27,
  Powder: 28,
  Brick: 29,
  Rift: 30,
  Tnt: 31,
  Nitro: 32,
  Mite: 33,
  Minnow: 34,
  Bloom: 35,
  Pearl: 36,
} as const;

export type MaterialId = (typeof Material)[keyof typeof Material];

export type MatterKind = 'powder' | 'liquid' | 'gas' | 'static';

export interface MaterialInfo {
  readonly name: string;
  /** Base RGB used by the renderer. */
  readonly color: readonly [number, number, number];
  /** Relative mass per cell. Heavier materials should displace lighter ones. */
  readonly density: number;
  /** Whether the simulation is allowed to move this cell at all. */
  readonly movable: boolean;
  readonly kind: MatterKind;
}

export const MATERIALS: Record<MaterialId, MaterialInfo> = {
  [Material.Air]: { name: 'air', color: [14, 14, 20], density: 10, movable: true, kind: 'static' },
  [Material.Sand]: {
    name: 'sand',
    color: [214, 176, 96],
    density: 160,
    movable: true,
    kind: 'powder',
  },
  [Material.Water]: {
    name: 'water',
    color: [58, 122, 214],
    density: 100,
    movable: true,
    kind: 'liquid',
  },
  [Material.Stone]: {
    name: 'stone',
    color: [110, 110, 118],
    density: 255,
    movable: false,
    kind: 'static',
  },
  [Material.Fire]: {
    name: 'fire',
    color: [255, 84, 28],
    density: 3,
    movable: false,
    kind: 'static',
  },
  [Material.Plant]: {
    name: 'plant',
    color: [42, 158, 68],
    density: 40,
    movable: false,
    kind: 'static',
  },
  [Material.Oil]: { name: 'oil', color: [138, 72, 24], density: 70, movable: true, kind: 'liquid' },
  [Material.Seed]: {
    name: 'seed',
    color: [186, 142, 48],
    density: 130,
    movable: true,
    kind: 'powder',
  },
  [Material.Ash]: {
    name: 'ash',
    color: [168, 168, 172],
    density: 45,
    movable: true,
    kind: 'powder',
  },
  [Material.Mud]: { name: 'mud', color: [92, 64, 40], density: 170, movable: true, kind: 'powder' },
  [Material.Glass]: {
    name: 'glass',
    color: [148, 206, 196],
    density: 255,
    movable: false,
    kind: 'static',
  },
  [Material.Moss]: {
    name: 'moss',
    color: [28, 92, 48],
    density: 30,
    movable: false,
    kind: 'static',
  },
  [Material.Ice]: {
    name: 'ice',
    color: [176, 214, 232],
    density: 255,
    movable: false,
    kind: 'static',
  },
  [Material.Wood]: {
    name: 'wood',
    color: [118, 78, 42],
    density: 255,
    movable: false,
    kind: 'static',
  },
  [Material.Salt]: {
    name: 'salt',
    color: [236, 232, 224],
    density: 150,
    movable: true,
    kind: 'powder',
  },
  [Material.Steam]: {
    name: 'steam',
    color: [198, 206, 214],
    density: 2,
    movable: true,
    kind: 'gas',
  },
  [Material.Lava]: {
    name: 'lava',
    color: [255, 106, 12],
    density: 205,
    movable: true,
    kind: 'liquid',
  },
  [Material.Ember]: {
    name: 'ember',
    color: [220, 64, 32],
    density: 18,
    movable: true,
    kind: 'powder',
  },
  [Material.Obsidian]: {
    name: 'obsidian',
    color: [28, 24, 36],
    density: 255,
    movable: false,
    kind: 'static',
  },
  [Material.Brine]: {
    name: 'brine',
    color: [36, 148, 168],
    density: 118,
    movable: true,
    kind: 'liquid',
  },
  [Material.Crystal]: {
    name: 'crystal',
    color: [186, 154, 220],
    density: 255,
    movable: false,
    kind: 'static',
  },
  [Material.Acid]: {
    name: 'acid',
    color: [156, 214, 48],
    density: 108,
    movable: true,
    kind: 'liquid',
  },
  [Material.Lead]: {
    name: 'lead',
    color: [86, 90, 98],
    density: 195,
    movable: true,
    kind: 'powder',
  },
  [Material.Mercury]: {
    name: 'mercury',
    color: [176, 186, 196],
    density: 188,
    movable: true,
    kind: 'liquid',
  },
  [Material.Gold]: {
    name: 'gold',
    color: [232, 178, 48],
    density: 220,
    movable: true,
    kind: 'powder',
  },
  [Material.Aether]: {
    name: 'aether',
    color: [120, 220, 255],
    density: 1,
    movable: true,
    kind: 'gas',
  },
  [Material.Azoth]: {
    name: 'azoth',
    color: [218, 88, 168],
    density: 255,
    movable: false,
    kind: 'static',
  },
  [Material.Void]: { name: 'void', color: [8, 0, 18], density: 40, movable: true, kind: 'powder' },
  [Material.Powder]: {
    name: 'powder',
    color: [48, 42, 38],
    density: 85,
    movable: true,
    kind: 'powder',
  },
  [Material.Brick]: {
    name: 'brick',
    color: [176, 92, 64],
    density: 255,
    movable: false,
    kind: 'static',
  },
  [Material.Rift]: {
    name: 'rift',
    color: [92, 44, 148],
    density: 255,
    movable: false,
    kind: 'static',
  },
  [Material.Tnt]: {
    name: 'tnt',
    color: [196, 52, 44],
    density: 255,
    movable: false,
    kind: 'static',
  },
  [Material.Nitro]: {
    name: 'nitro',
    color: [72, 160, 64],
    density: 95,
    movable: true,
    kind: 'liquid',
  },
  [Material.Mite]: {
    name: 'mite',
    color: [196, 152, 78],
    density: 52,
    movable: true,
    kind: 'powder',
  },
  [Material.Minnow]: {
    name: 'minnow',
    color: [74, 186, 198],
    density: 88,
    movable: true,
    kind: 'powder',
  },
  [Material.Bloom]: {
    name: 'bloom',
    color: [236, 64, 112],
    density: 35,
    movable: false,
    kind: 'static',
  },
  [Material.Pearl]: {
    name: 'pearl',
    color: [210, 198, 178],
    density: 255,
    movable: false,
    kind: 'static',
  },
};

/** Half-range of the persistent per-grain RGB offset rolled on paint. */
export const SHADE_RANGE: Record<MaterialId, number> = {
  [Material.Air]: 0,
  [Material.Sand]: 18,
  [Material.Water]: 14,
  [Material.Stone]: 5,
  [Material.Fire]: 22,
  [Material.Plant]: 12,
  [Material.Oil]: 16,
  [Material.Seed]: 14,
  [Material.Ash]: 12,
  [Material.Mud]: 14,
  [Material.Glass]: 10,
  [Material.Moss]: 10,
  [Material.Ice]: 10,
  [Material.Wood]: 12,
  [Material.Salt]: 16,
  [Material.Steam]: 18,
  [Material.Lava]: 20,
  [Material.Ember]: 18,
  [Material.Obsidian]: 6,
  [Material.Brine]: 12,
  [Material.Crystal]: 14,
  [Material.Acid]: 14,
  [Material.Lead]: 8,
  [Material.Mercury]: 16,
  [Material.Gold]: 18,
  [Material.Aether]: 20,
  [Material.Azoth]: 22,
  [Material.Void]: 4,
  [Material.Powder]: 10,
  [Material.Brick]: 8,
  [Material.Rift]: 16,
  [Material.Tnt]: 10,
  [Material.Nitro]: 14,
  [Material.Mite]: 16,
  [Material.Minnow]: 14,
  [Material.Bloom]: 12,
  [Material.Pearl]: 10,
};

function heatTable(
  fallback: number,
  overrides: Partial<Record<MaterialId, number>>,
): Record<MaterialId, number> {
  const out = {} as Record<MaterialId, number>;
  for (const id of Object.values(Material)) {
    out[id] = overrides[id] ?? fallback;
  }
  return out;
}

/**
 * Rest temperature of a grain, 0–255. Used as the sink in Newton's cooling
 * and as the paint-time heat of a newly set cell.
 */
export const HEAT_AMBIENT: Record<MaterialId, number> = heatTable(18, {
  [Material.Ice]: 3,
  [Material.Water]: 34,
  [Material.Brine]: 32,
  [Material.Steam]: 88,
  [Material.Fire]: 220,
  [Material.Lava]: 255,
  [Material.Ember]: 200,
  [Material.Oil]: 22,
  [Material.Acid]: 28,
  [Material.Mercury]: 24,
  [Material.Nitro]: 26,
  [Material.Aether]: 40,
  [Material.Obsidian]: 14,
  [Material.Glass]: 16,
  [Material.Crystal]: 12,
});

/**
 * Thermal diffusivity α in T' = T + (α/32) ∇²T.
 * Four-neighbor explicit Euler is CFL-stable only for α ≤ 8
 * (the T coefficient is 1 − α/8; above 8 it goes negative and heat explodes).
 * Metals sit at the cap; glass, wood, and obsidian crawl.
 */
export const HEAT_CONDUCT: Record<MaterialId, number> = heatTable(4, {
  [Material.Air]: 7,
  [Material.Steam]: 7,
  [Material.Aether]: 7,
  [Material.Water]: 6,
  [Material.Brine]: 6,
  [Material.Acid]: 6,
  [Material.Mercury]: 8,
  [Material.Gold]: 8,
  [Material.Lead]: 8,
  [Material.Ice]: 5,
  [Material.Sand]: 4,
  [Material.Stone]: 4,
  [Material.Brick]: 4,
  [Material.Glass]: 2,
  [Material.Wood]: 2,
  [Material.Plant]: 3,
  [Material.Bloom]: 3,
  [Material.Moss]: 3,
  [Material.Obsidian]: 1,
  [Material.Fire]: 6,
  [Material.Lava]: 6,
  [Material.Ember]: 6,
});

/** Continuous heat sources restoked each tick. Zero means the grain only conducts. */
export const HEAT_SOURCE: Record<MaterialId, number> = heatTable(0, {
  [Material.Fire]: 220,
  [Material.Lava]: 255,
  [Material.Ember]: 200,
  [Material.Steam]: 90,
});

export function seedHeat(id: MaterialId): number {
  const source = HEAT_SOURCE[id];
  return source > 0 ? source : HEAT_AMBIENT[id];
}

/** Reagents the alchemist starts with. */
export const STARTER: readonly MaterialId[] = [
  Material.Sand,
  Material.Water,
  Material.Stone,
  Material.Seed,
  Material.Oil,
  Material.Fire,
  Material.Air,
  Material.Ice,
  Material.Wood,
  Material.Salt,
  Material.Lava,
  Material.Acid,
  Material.Lead,
  Material.Tnt,
];

/** Appear in the world through transmutation; unlock on the palette when first seen. */
export const TRANSMUTED: readonly MaterialId[] = [
  Material.Plant,
  Material.Ash,
  Material.Mud,
  Material.Glass,
  Material.Moss,
  Material.Steam,
  Material.Ember,
  Material.Obsidian,
  Material.Brine,
  Material.Crystal,
  Material.Mercury,
  Material.Gold,
  Material.Aether,
  Material.Azoth,
  Material.Void,
  Material.Powder,
  Material.Brick,
  Material.Rift,
  Material.Nitro,
  Material.Mite,
  Material.Minnow,
  Material.Bloom,
  Material.Pearl,
];

const MATERIAL_IDS = new Set<number>(Object.values(Material));

export function isMaterialId(value: number): value is MaterialId {
  return MATERIAL_IDS.has(value);
}
