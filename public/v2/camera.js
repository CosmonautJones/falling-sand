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
// 4× a tall phone's height-fill is about 15.4 (390×844). 16 keeps that stop, and the
// one past it, inside the same cap the pinch and the zoom button share.
export const MAX_ZOOM = 16;

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

// Optional last argument: CSS pixels covered by chrome. A number is the bottom
// edge, kept so older callers stay valid. An object may set `left`, `right`,
// and `bottom`. Zero insets keep the old clamp. A positive inset lets that
// edge of the world slide until it clears the chrome, and no further.
function edgeInsets(edge) {
  if (typeof edge === 'number') return { left: 0, right: 0, bottom: Math.max(0, finite(edge, 0)) };
  if (!edge || typeof edge !== 'object') return { left: 0, right: 0, bottom: 0 };
  return {
    left: Math.max(0, finite(edge.left, 0)),
    right: Math.max(0, finite(edge.right, 0)),
    bottom: Math.max(0, finite(edge.bottom, 0)),
  };
}

// Whole-vessel zoom that fits between a left and a right cover. Zoom 1 is the
// world fitted to the viewport; two covers can make that wider than the gap
// (a landscape phone with a rail and a notch). Shrinking only applies at the
// whole-vessel zoom. A closer view stays where the player put it and may pan
// one edge under a cover. One cover alone does not shrink the world.
function sideFitZoom(vw, base, insets) {
  if (!(insets.left > 0) || !(insets.right > 0) || !(base > 0) || !(vw > 0)) return MIN_ZOOM;
  const room = vw - insets.left - insets.right;
  const need = WORLD_W * base;
  if (!(room > 1) || need <= room + 0.001) return MIN_ZOOM;
  return room / need;
}

// Place the world along one axis. When it fits between the insets, center it
// there. When it does not, `origin` may slide until either inset edge shows,
// and no further.
function axisOrigin(span, world, origin, insetStart, insetEnd) {
  const start = Math.max(0, insetStart);
  const end = Math.max(start, span - Math.max(0, insetEnd));
  const room = end - start;
  if (world <= room + 0.001) return start + (room - world) / 2;
  return Math.min(start, Math.max(end - world, origin));
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

export function clampView(vw, vh, view, edge = 0) {
  const frame = frameOffset(vw, vh);
  const insets = edgeInsets(edge);
  let zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, finite(view.zoom, 1)));
  const fitted = sideFitZoom(vw, frame.base, insets);
  // The whole vessel (zoom 1, and anything the cap rounded up to it) shrinks
  // until both covers clear. A zoom above that is a closer look and stays.
  if (fitted < MIN_ZOOM && zoom <= MIN_ZOOM + 1e-4) zoom = fitted;
  const scale = frame.base * zoom;
  const worldW = WORLD_W * scale;
  const worldH = WORLD_H * scale;
  const originX = axisOrigin(vw, worldW, frame.x + finite(view.panX, 0), insets.left, insets.right);
  const originY = axisOrigin(vh, worldH, frame.y + finite(view.panY, 0), 0, insets.bottom);
  return { zoom, panX: originX - frame.x, panY: originY - frame.y };
}

export function screenToGrain(vw, vh, view, sx, sy, edge = 0) {
  const cam = cameraFromView(vw, vh, clampView(vw, vh, view, edge));
  return { x: (sx - cam.x) / cam.scale, y: (sy - cam.y) / cam.scale };
}

// Screen position of a grain's center.
export function grainToScreen(vw, vh, view, gx, gy, edge = 0) {
  const cam = cameraFromView(vw, vh, clampView(vw, vh, view, edge));
  return { x: cam.x + (gx + 0.5) * cam.scale, y: cam.y + (gy + 0.5) * cam.scale };
}

// Keep the world fraction (gx, gy) under the screen point while zoom changes.
export function viewFromAnchor(vw, vh, zoom, sx, sy, gx, gy, edge = 0) {
  const frame = frameOffset(vw, vh);
  const scale = frame.base * zoom;
  const originX = sx - gx * WORLD_W * scale;
  const originY = sy - gy * WORLD_H * scale;
  return clampView(vw, vh, { zoom, panX: originX - frame.x, panY: originY - frame.y }, edge);
}

export function zoomAround(vw, vh, view, factor, sx, sy, edge = 0) {
  const clamped = clampView(vw, vh, view, edge);
  const grain = screenToGrain(vw, vh, clamped, sx, sy, edge);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, clamped.zoom * factor));
  return viewFromAnchor(vw, vh, zoom, sx, sy, grain.x / WORLD_W, grain.y / WORLD_H, edge);
}

export function panView(vw, vh, view, dx, dy, edge = 0) {
  const clamped = clampView(vw, vh, view, edge);
  return clampView(vw, vh, { zoom: clamped.zoom, panX: clamped.panX + dx, panY: clamped.panY + dy }, edge);
}

// Center a grain (not a fraction) in the viewport, keeping zoom.
export function panToCenter(vw, vh, view, gx, gy, edge = 0) {
  const clamped = clampView(vw, vh, view, edge);
  const frame = frameOffset(vw, vh);
  const scale = frame.base * clamped.zoom;
  const originX = vw / 2 - gx * scale;
  const originY = vh / 2 - gy * scale;
  return clampView(vw, vh, { zoom: clamped.zoom, panX: originX - frame.x, panY: originY - frame.y }, edge);
}

// Whole world on a desktop-shaped viewport. Height-filling crop when the
// viewport is taller than 480:270 (a phone held upright). A bottom inset lifts
// that crop so the floor clears a bar. A left inset shifts a fitted world
// sideways so its left edge clears a rail. A right inset keeps the right wall
// out of that safe area. When both side covers are set and the world is wider
// than the gap, the whole-vessel zoom shrinks until it fits between them.
export function defaultView(vw, vh, edge = 0) {
  if (!(vw > 0) || !(vh > 0)) return { zoom: 1, panX: 0, panY: 0 };
  const worldAspect = WORLD_W / WORLD_H;
  const insets = edgeInsets(edge);
  const wide = vw / vh >= worldAspect * 0.995;
  if (wide && !(insets.bottom > 0) && !(insets.left > 0) && !(insets.right > 0)) return { zoom: 1, panX: 0, panY: 0 };
  const base = containScale(vw, vh);
  const zoom = wide ? 1 : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fillHeightScale(vh) / base));
  const scale = base * zoom;
  const frame = frameOffset(vw, vh);
  let originX = (vw - WORLD_W * scale) / 2;
  let originY = (vh - WORLD_H * scale) / 2;
  if (insets.bottom > 0) originY = Math.min(originY, (vh - insets.bottom) - WORLD_H * scale);
  if (insets.right > 0) originX = Math.min(originX, (vw - insets.right) - WORLD_W * scale);
  if (insets.left > 0) originX = Math.max(originX, insets.left);
  return clampView(vw, vh, { zoom, panX: originX - frame.x, panY: originY - frame.y }, edge);
}

// Visible world, as fractions of the vessel, for the minimap.
export function viewRect(vw, vh, view, edge = 0) {
  const cam = cameraFromView(vw, vh, clampView(vw, vh, view, edge));
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
