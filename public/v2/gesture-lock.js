// Stray touches outside the vessel must never scroll, rubber-band, pull-to-refresh or zoom the page.
// Anything marked [data-scroll] (menus, codex) keeps its own scrolling.
export function lockPageGestures(doc) {
  const onMove = e => { if (!(e.target && e.target.closest && e.target.closest('[data-scroll]'))) e.preventDefault(); };
  const onGesture = e => e.preventDefault();
  doc.addEventListener('touchmove', onMove, { passive: false });
  doc.addEventListener('gesturestart', onGesture, { passive: false });
  doc.addEventListener('gesturechange', onGesture, { passive: false });
  return () => {
    doc.removeEventListener('touchmove', onMove, { passive: false });
    doc.removeEventListener('gesturestart', onGesture, { passive: false });
    doc.removeEventListener('gesturechange', onGesture, { passive: false });
  };
}
