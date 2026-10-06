// Native fullscreen is optional on phones; the same layout works without it.
export async function toggleScreen(root, doc = document) {
  const active = root.hasAttribute('data-immersive') || doc.fullscreenElement === root;
  root.toggleAttribute('data-immersive', !active);
  try {
    if (active && doc.fullscreenElement === root) await doc.exitFullscreen();
    else if (!active && root.requestFullscreen) await root.requestFullscreen();
  } catch { /* Keep immersive mode when the browser declines fullscreen. */ }
}
