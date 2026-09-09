export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

export interface View {
  zoom: number;
  panX: number;
  panY: number;
}

export function createView(): View {
  return { zoom: 1, panX: 0, panY: 0 };
}

export function clampPan(view: View, vw: number, vh: number): View {
  const minX = vw - vw * view.zoom;
  const minY = vh - vh * view.zoom;
  return {
    zoom: view.zoom,
    panX: Math.min(0, Math.max(minX, view.panX)),
    panY: Math.min(0, Math.max(minY, view.panY)),
  };
}

/** Zoom around a screen point (viewport pixels) so that grain stays under the cursor. */
export function zoomAt(
  view: View,
  sx: number,
  sy: number,
  factor: number,
  vw: number,
  vh: number,
): View {
  const gx = (sx - view.panX) / (vw * view.zoom);
  const gy = (sy - view.panY) / (vh * view.zoom);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
  return clampPan(
    {
      zoom,
      panX: sx - gx * vw * zoom,
      panY: sy - gy * vh * zoom,
    },
    vw,
    vh,
  );
}

export function panBy(view: View, dx: number, dy: number, vw: number, vh: number): View {
  return clampPan({ zoom: view.zoom, panX: view.panX + dx, panY: view.panY + dy }, vw, vh);
}

export function screenToCell(
  view: View,
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  gw: number,
  gh: number,
): { x: number; y: number } {
  return {
    x: Math.floor(((sx - view.panX) / (vw * view.zoom)) * gw),
    y: Math.floor(((sy - view.panY) / (vh * view.zoom)) * gh),
  };
}
