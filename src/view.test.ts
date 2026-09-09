import { describe, expect, it } from 'vitest';
import { clampPan, createView, panBy, screenToCell, zoomAt } from './view';

describe('viewport', () => {
  it('starts at 1× with no pan', () => {
    expect(createView()).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it('zooms toward a screen point so the same grain stays under the cursor', () => {
    const view = zoomAt(createView(), 50, 40, 2, 100, 80);
    expect(view.zoom).toBe(2);
    const cell = screenToCell(view, 50, 40, 100, 80, 480, 270);
    const before = screenToCell(createView(), 50, 40, 100, 80, 480, 270);
    expect(cell).toEqual(before);
  });

  it('will not zoom out past 1× or in past 8×', () => {
    expect(zoomAt(createView(), 0, 0, 0.5, 100, 100).zoom).toBe(1);
    expect(zoomAt(createView(), 0, 0, 100, 100, 100).zoom).toBe(8);
  });

  it('clamps pan so the vessel never shows empty margin', () => {
    const loose = clampPan({ zoom: 2, panX: 50, panY: -400 }, 100, 80);
    expect(loose.panX).toBe(0);
    expect(loose.panY).toBeGreaterThanOrEqual(80 - 160);
    expect(loose.panY).toBeLessThanOrEqual(0);
  });

  it('pans by a delta then clamps', () => {
    const zoomed = zoomAt(createView(), 50, 40, 2, 100, 80);
    const moved = panBy(zoomed, -10, 5, 100, 80);
    expect(moved.zoom).toBe(2);
    expect(moved.panX).not.toBe(zoomed.panX);
  });

  it('maps the top-left of an unzoomed view to cell 0,0', () => {
    expect(screenToCell(createView(), 0, 0, 100, 80, 480, 270)).toEqual({ x: 0, y: 0 });
  });
});
