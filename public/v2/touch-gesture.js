// One-finger touch on the vessel: a drag always pours (from where the finger landed),
// a still 450 ms hold names the grain, and a quick tap drops one dab.
export const LONG_PRESS_MS = 450, MOVE_SLOP = 8;

const movedPastSlop = (dx, dy) => Math.hypot(dx, dy) > MOVE_SLOP;
export function createTouchPour({ pour, probe, end, setTimer = setTimeout, clearTimer = clearTimeout, moved = movedPastSlop }) {
  let mode = 'idle', sx = 0, sy = 0, timer = 0;
  const stop = () => { if (timer) { clearTimer(timer); timer = 0; } };
  return {
    get mode() { return mode; },
    down(x, y) {
      stop(); mode = 'pending'; sx = x; sy = y;
      timer = setTimer(() => { timer = 0; if (mode === 'pending') { mode = 'probe'; probe(sx, sy); } }, LONG_PRESS_MS);
    },
    move(x, y) {
      if (mode === 'pending') {
        if (!moved(x - sx, y - sy)) return;
        stop(); mode = 'pour'; pour(sx, sy);
      }
      if (mode === 'pour') pour(x, y);
      else if (mode === 'probe') probe(x, y);
    },
    up() {
      stop();
      if (mode === 'pending') pour(sx, sy);
      mode = 'idle'; end();
    },
    cancel() { stop(); mode = 'cancelled'; },
  };
}
