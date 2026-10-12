// Camera geometry in CSS pixels. A tall viewport crops the same 480x270 world;
// one world cell always has the same width and height on screen.
export function layout(width, height) {
  const worldWidth = width, worldHeight = width * 270 / 480;
  return { width, height, worldWidth, worldHeight, minZoom: Math.max(1, height / worldHeight) };
}

export function bufferSize(l, scale) {
  const width = Math.min(2560, Math.max(480, Math.round(l.width * scale)));
  return { width, height: Math.round(width * l.height / l.width) };
}

export function clampView(l, v) {
  const zoom = Math.max(l.minZoom, Math.min(12, v.zoom));
  return {
    zoom,
    panX: Math.min(0, Math.max(l.width - l.worldWidth * zoom, v.panX)),
    panY: Math.min(0, Math.max(l.height - l.worldHeight * zoom, v.panY)),
  };
}

export function closeView(l) {
  const zoom = Math.min(12, l.minZoom * 1.25);
  // Frame the pond and casks, with the floor at the bottom of the screen.
  return clampView(l, { zoom, panX: l.width / 2 - l.worldWidth * zoom * 0.55, panY: l.height - l.worldHeight * zoom });
}

export function cellAt(l, v, x, y) {
  return { x: Math.floor((x - v.panX) / (l.worldWidth * v.zoom) * 480), y: Math.floor((y - v.panY) / (l.worldHeight * v.zoom) * 270) };
}

export function cellToPx(l, v, c) {
  return { x: (c.x + 0.5) / 480 * l.worldWidth * v.zoom + v.panX, y: (c.y + 0.5) / 270 * l.worldHeight * v.zoom + v.panY };
}

export function zoomAt(l, v, zoom, x, y) {
  zoom = Math.max(l.minZoom, Math.min(12, zoom));
  const gx = (x - v.panX) / (l.worldWidth * v.zoom), gy = (y - v.panY) / (l.worldHeight * v.zoom);
  return clampView(l, { zoom, panX: x - gx * l.worldWidth * zoom, panY: y - gy * l.worldHeight * zoom });
}

export function reframe(before, after, v) {
  const gx = (before.width / 2 - v.panX) / (before.worldWidth * v.zoom);
  const gy = (before.height / 2 - v.panY) / (before.worldHeight * v.zoom);
  const zoom = Math.max(after.minZoom, v.zoom);
  return clampView(after, { zoom, panX: after.width / 2 - gx * after.worldWidth * zoom, panY: after.height / 2 - gy * after.worldHeight * zoom });
}
