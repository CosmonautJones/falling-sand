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

export function clampPan(view: View, vw: number, vh: number, cw = vw, ch = vh): View {
  const minX = vw - cw * view.zoom;
  const minY = vh - ch * view.zoom;
  return {
    zoom: view.zoom,
    panX: minX > 0 ? minX / 2 : Math.min(0, Math.max(minX, view.panX)),
    panY: minY > 0 ? minY / 2 : Math.min(0, Math.max(minY, view.panY)),
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
  cw = vw,
  ch = vh,
): View {
  const gx = (sx - view.panX) / (cw * view.zoom);
  const gy = (sy - view.panY) / (ch * view.zoom);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
  return clampPan(
    {
      zoom,
      panX: sx - gx * cw * zoom,
      panY: sy - gy * ch * zoom,
    },
    vw,
    vh,
    cw,
    ch,
  );
}

export function panBy(
  view: View,
  dx: number,
  dy: number,
  vw: number,
  vh: number,
  cw = vw,
  ch = vh,
): View {
  return clampPan({ zoom: view.zoom, panX: view.panX + dx, panY: view.panY + dy }, vw, vh, cw, ch);
}

export interface PinchFrame {
  x: number;
  y: number;
  distance: number;
}

/** Apply two-finger translation and scale together, clamping only the final camera. */
export function pinchBetween(
  view: View,
  from: PinchFrame,
  to: PinchFrame,
  vw: number,
  vh: number,
  cw = vw,
  ch = vh,
): View {
  const zoom = Math.min(
    MAX_ZOOM,
    Math.max(MIN_ZOOM, view.zoom * (from.distance > 0 ? to.distance / from.distance : 1)),
  );
  return clampPan(
    {
      zoom,
      panX: to.x - ((from.x - view.panX) * zoom) / view.zoom,
      panY: to.y - ((from.y - view.panY) * zoom) / view.zoom,
    },
    vw,
    vh,
    cw,
    ch,
  );
}

/** Bring a world cell into view, keeping the camera inside the vessel. */
export function focusAt(
  x: number,
  y: number,
  requestedZoom: number,
  vw: number,
  vh: number,
  gw: number,
  gh: number,
  cw = vw,
  ch = vh,
): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, requestedZoom));
  return clampPan(
    { zoom, panX: vw / 2 - (x / gw) * cw * zoom, panY: vh / 2 - (y / gh) * ch * zoom },
    vw,
    vh,
    cw,
    ch,
  );
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
