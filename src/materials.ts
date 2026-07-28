export const Material = {
  Air: 0,
  Sand: 1,
  Water: 2,
  Stone: 3,
} as const;

export type MaterialId = (typeof Material)[keyof typeof Material];

export interface MaterialInfo {
  readonly name: string;
  /** Base RGB used by the renderer. */
  readonly color: readonly [number, number, number];
  /** Relative mass per cell. Heavier materials should displace lighter ones. */
  readonly density: number;
  /** Whether the simulation is allowed to move this cell at all. */
  readonly movable: boolean;
}

export const MATERIALS: Record<MaterialId, MaterialInfo> = {
  [Material.Air]: { name: 'air', color: [14, 14, 20], density: 1, movable: true },
  [Material.Sand]: { name: 'sand', color: [214, 176, 96], density: 160, movable: true },
  [Material.Water]: { name: 'water', color: [58, 122, 214], density: 100, movable: true },
  [Material.Stone]: { name: 'stone', color: [110, 110, 118], density: 255, movable: false },
};

export function isMaterialId(value: number): value is MaterialId {
  return value === Material.Air || value === Material.Sand || value === Material.Water || value === Material.Stone;
}
