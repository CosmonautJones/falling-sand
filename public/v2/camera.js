// Screen camera for the 480×270 vessel.
//
// The view the controls already speak ({ zoom, panX, panY }) stays: zoom 1 and
// pan 0 is the whole world fitted inside the viewport. What changed is the
// picture of that view. Grains are square on any screen. `zoom` scales the
// fitted world; pan is a pixel nudge from that fitted frame. A viewport taller
// than the world (a phone) starts cropped so the world height fills the screen
// — about 125 columns and about 3px per grain on a 390×844 phone.
//
// Shader uniform uCamera is this camera in screen UV (y down):
//   xy = world origin, zw = how much of the screen the whole world spans.
// zw differs per axis when the viewport aspect is not 480:270, which is what
// keeps a grain square. A single UV zoom cannot.

export const WORLD_W = 480;
export const WORLD_H = 270;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 12;

const finite = (n, fallback) => (Number.isFinite(n) ? n : fallback);

export function containScale(vw, vh) {
  if (!(vw > 0) || !(vh > 0)) return 1;
  return Math.min(vw / WORLD_W, vh / WORLD_H);
}

// Pixels per grain when the world height fills the viewport.
export function fillHeightScale(vh) {
  return vh > 0 ? vh / WORLD_H : 1;
}

function frameOffset(vw, vh) {
  const base = containScale(vw, vh);
  return { base, x: (vw - WORLD_W * base) / 2, y: (vh - WORLD_H * base) / 2 };
}

// Pixel camera: world origin (grain 0,0) at (x, y), `scale` CSS pixels per grain.
export function cameraFromView(vw, vh, view) {
  const frame = frameOffset(vw, vh);
  const zoom = finite(view.zoom, 1);
  const scale = frame.base * zoom;
  return {
    x: frame.x + finite(view.panX, 0),
    y: frame.y + finite(view.panY, 0),
    scale,
    base: frame.base,
    zoom,
  };
}

export function clampView(vw, vh, view) {
  const frame = frameOffset(vw, vh);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, finite(view.zoom, 1)));
  const scale = frame.base * zoom;
  const worldW = WORLD_W * scale;
  const worldH = WORLD_H * scale;
  let originX = frame.x + finite(view.panX, 0);
  let originY = frame.y + finite(view.panY, 0);
  if (worldW <= vw + 0.001) originX = (vw - worldW) / 2;
  else originX = Math.min(0, Math.max(vw - worldW, originX));
  if (worldH <= vh + 0.001) originY = (vh - worldH) / 2;
  else originY = Math.min(0, Math.max(vh - worldH, originY));
  return { zoom, panX: originX - frame.x, panY: originY - frame.y };
}

export function screenToGrain(vw, vh, view, sx, sy) {
  const cam = cameraFromView(vw, vh, clampView(vw, vh, view));
  return { x: (sx - cam.x) / cam.scale, y: (sy - cam.y) / cam.scale };
}

// Screen position of a grain's center.
export function grainToScreen(vw, vh, view, gx, gy) {
  const cam = cameraFromView(vw, vh, clampView(vw, vh, view));
  return { x: cam.x + (gx + 0.5) * cam.scale, y: cam.y + (gy + 0.5) * cam.scale };
}

// Keep the world fraction (gx, gy) under the screen point while zoom changes.
export function viewFromAnchor(vw, vh, zoom, sx, sy, gx, gy) {
  const frame = frameOffset(vw, vh);
  const scale = frame.base * zoom;
  const originX = sx - gx * WORLD_W * scale;
  const originY = sy - gy * WORLD_H * scale;
  return clampView(vw, vh, { zoom, panX: originX - frame.x, panY: originY - frame.y });
}

export function zoomAround(vw, vh, view, factor, sx, sy) {
  const clamped = clampView(vw, vh, view);
  const grain = screenToGrain(vw, vh, clamped, sx, sy);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, clamped.zoom * factor));
  return viewFromAnchor(vw, vh, zoom, sx, sy, grain.x / WORLD_W, grain.y / WORLD_H);
}

export function panView(vw, vh, view, dx, dy) {
  const clamped = clampView(vw, vh, view);
  return clampView(vw, vh, { zoom: clamped.zoom, panX: clamped.panX + dx, panY: clamped.panY + dy });
}

// Center a grain (not a fraction) in the viewport, keeping zoom.
export function panToCenter(vw, vh, view, gx, gy) {
  const clamped = clampView(vw, vh, view);
  const frame = frameOffset(vw, vh);
  const scale = frame.base * clamped.zoom;
  const originX = vw / 2 - gx * scale;
  const originY = vh / 2 - gy * scale;
  return clampView(vw, vh, { zoom: clamped.zoom, panX: originX - frame.x, panY: originY - frame.y });
}

// Whole world on a desktop-shaped viewport. Height-filling crop when the
// viewport is taller than 480:270 (a phone held upright).
export function defaultView(vw, vh) {
  if (!(vw > 0) || !(vh > 0)) return { zoom: 1, panX: 0, panY: 0 };
  const worldAspect = WORLD_W / WORLD_H;
  if (vw / vh >= worldAspect * 0.995) return { zoom: 1, panX: 0, panY: 0 };
  const base = containScale(vw, vh);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fillHeightScale(vh) / base));
  const scale = base * zoom;
  const frame = frameOffset(vw, vh);
  const originX = (vw - WORLD_W * scale) / 2;
  const originY = (vh - WORLD_H * scale) / 2;
  return clampView(vw, vh, { zoom, panX: originX - frame.x, panY: originY - frame.y });
}

// Visible world, as fractions of the vessel, for the minimap.
export function viewRect(vw, vh, view) {
  const cam = cameraFromView(vw, vh, clampView(vw, vh, view));
  const x0 = Math.max(0, (0 - cam.x) / cam.scale);
  const y0 = Math.max(0, (0 - cam.y) / cam.scale);
  const x1 = Math.min(WORLD_W, (vw - cam.x) / cam.scale);
  const y1 = Math.min(WORLD_H, (vh - cam.y) / cam.scale);
  return {
    x: x0 / WORLD_W,
    y: y0 / WORLD_H,
    w: Math.max(0, x1 - x0) / WORLD_W,
    h: Math.max(0, y1 - y0) / WORLD_H,
  };
}

export function shaderCamera(vw, vh, cam) {
  const w = vw > 0 ? vw : 1;
  const h = vh > 0 ? vh : 1;
  return {
    x: cam.x / w,
    y: cam.y / h,
    z: (cam.scale * WORLD_W) / w,
    w: (cam.scale * WORLD_H) / h,
  };
}

// Blast punch: zoom a few percent toward a world UV point without letting that
// point slide on the screen. `k` is 1 when there is no punch.
export function punchCamera(cam, k, ax, ay) {
  if (!(k > 0) || k === 1) return cam;
  const sx = cam.x + ax * WORLD_W * cam.scale;
  const sy = cam.y + ay * WORLD_H * cam.scale;
  return {
    ...cam,
    scale: cam.scale * k,
    x: sx - ax * WORLD_W * cam.scale * k,
    y: sy - ay * WORLD_H * cam.scale * k,
  };
}
