import { Grid } from './grid';
import { Material } from './materials';

/**
 * Baseline simulation step. Deliberately naive.
 *
 * Sand falls straight down into air and piles into flat-topped columns.
 * That is all it does. It has no notion of:
 *   - liquids (water is inert here)
 *   - air as a moving medium, pressure, or advection
 *   - density exchange between materials
 *   - lateral flow, slope, or angle of repose
 *   - update ordering bias (it scans bottom-up, left-to-right every frame)
 *
 * This is the placeholder that the real air + liquid engine replaces.
 */
export function step(grid: Grid): void {
  for (let y = grid.height - 2; y >= 0; y--) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.get(x, y) !== Material.Sand) continue;
      if (grid.get(x, y + 1) === Material.Air) {
        grid.swap(x, y, x, y + 1);
      }
    }
  }
}
