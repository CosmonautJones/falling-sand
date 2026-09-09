import { Material, type MaterialId } from './materials';

const LINES: Partial<Record<MaterialId, string>> = {
  [Material.Plant]: 'Seed drinks. The garden answers.',
  [Material.Ash]: 'Fire without fuel keeps a grey secret.',
  [Material.Mud]: 'Ash slakes. The floor remembers rain.',
  [Material.Glass]: 'Sand looks upon fire and learns to see.',
  [Material.Moss]: 'Wet stone grows a quiet pelt.',
  [Material.Steam]: 'Water climbs as a ghost.',
  [Material.Ember]: 'Wood throws a falling star.',
  [Material.Obsidian]: 'Lava and water argue. Night wins.',
  [Material.Brine]: 'Salt drinks and will not freeze easily.',
  [Material.Crystal]: 'Hot brine keeps a violet bone.',
  [Material.Mercury]: 'Lead sheds its weight. Hermes laughs.',
  [Material.Gold]: 'The roast is finished. The king is in the cup.',
  [Material.Aether]: 'Steam kisses crystal and forgets to fall.',
  [Material.Azoth]: 'Solve et coagula. The Work is in the vessel.',
  [Material.Void]: 'A black sun. It is hungry.',
  [Material.Powder]: 'Salt and ash make a short argument.',
  [Material.Brick]: 'Mud remembers fire and stands.',
  [Material.Rift]: 'A door of night. What falls in forgets its name.',
  [Material.Nitro]: 'Oil drinks powder and waits for a spark.',
};

export function whisper(id: MaterialId): string {
  return LINES[id] ?? '';
}
