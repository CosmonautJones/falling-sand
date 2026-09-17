type PageVisibility = EventTarget & { readonly hidden: boolean };
type FrameClock = {
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
};

/** Schedule no simulation or presentation work while the page is hidden. */
export function startVisibleLoop(
  callbacks: { frame: FrameRequestCallback; resume: () => void; suspend: () => void },
  page: PageVisibility = document,
  clock: FrameClock = {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (id) => cancelAnimationFrame(id),
  },
): () => void {
  let pending: number | null = null;
  let active = false;
  let generation = 0;

  function schedule(): void {
    const current = generation;
    pending = clock.request((now) => {
      if (!active || current !== generation) return;
      if (page.hidden) {
        reconcile();
        return;
      }
      pending = null;
      callbacks.frame(now);
      if (active && current === generation) schedule();
    });
  }

  function suspend(): void {
    if (!active) return;
    active = false;
    generation++;
    if (pending !== null) clock.cancel(pending);
    pending = null;
    callbacks.suspend();
  }

  function reconcile(): void {
    if (page.hidden) {
      suspend();
      return;
    }
    if (active) return;
    active = true;
    generation++;
    callbacks.resume();
    schedule();
  }

  page.addEventListener('visibilitychange', reconcile);
  reconcile();
  return () => {
    page.removeEventListener('visibilitychange', reconcile);
    suspend();
  };
}
