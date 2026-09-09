import { Grid } from './grid';
import { SHADE_RANGE, type MaterialId } from './materials';
import { randShade } from './rng';

export type RiteName = 'aether-rain' | 'gold-rain' | 'void-gift' | 'mercury-gift';

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const;

/** Keyboard and title rites. DOM-free so tests can drive the Great Work. */
export function createRite(): {
  titleClick: () => RiteName | null;
  key: (k: string) => RiteName | null;
} {
  let title = 0;
  let konami = 0;
  let typed = '';
  return {
    titleClick(): RiteName | null {
      title += 1;
      if (title < 7) return null;
      title = 0;
      return 'aether-rain';
    },
    key(k: string): RiteName | null {
      const token = k.length === 1 ? k.toLowerCase() : k;
      if (token === KONAMI[konami]) {
        konami += 1;
        if (konami === KONAMI.length) {
          konami = 0;
          return 'gold-rain';
        }
      } else {
        konami = token === KONAMI[0] ? 1 : 0;
      }
      if (/^[a-z]$/.test(token)) {
        typed = (typed + token).slice(-16);
        if (typed.endsWith('nigredo')) {
          typed = '';
          return 'void-gift';
        }
        if (typed.endsWith('hermes')) {
          typed = '';
          return 'mercury-gift';
        }
      }
      return null;
    },
  };
}

/** Sprinkle a reagent along the sky so it can fall as a gift. */
export function rainFromCeiling(grid: Grid, material: MaterialId, count: number): void {
  const span = Math.max(1, grid.width - 2);
  for (let i = 0; i < count; i++) {
    const x = 1 + (i % span);
    grid.set(x, 1, material, randShade(SHADE_RANGE[material]));
  }
}
