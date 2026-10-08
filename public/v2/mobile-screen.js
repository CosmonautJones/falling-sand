// Native fullscreen is optional on phones; the same layout works without it.
// Returns 'native' when the browser went fullscreen, 'immersive' for the layout-only fallback, 'off' on exit.
export async function toggleScreen(root, doc = document) {
  const current = doc.fullscreenElement || doc.webkitFullscreenElement || null;
  const active = root.hasAttribute('data-immersive') || current === root;
  root.toggleAttribute('data-immersive', !active);
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
  try {
    if (active) { if (current === root && exit) await exit.call(doc); return 'off'; }
    if (request) { await request.call(root); return 'native'; }
  } catch { /* Keep immersive mode when the browser declines fullscreen. */ }
  return active ? 'off' : 'immersive';
}
