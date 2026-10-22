// One finger pours on contact. A still 450 ms hold then names that grain.
// Moving past the slop keeps pouring. A second finger cancels and the page undoes the dab.
export const LONG_PRESS_MS = 450, MOVE_SLOP = 8;

const movedPastSlop = (dx, dy) => Math.hypot(dx, dy) > MOVE_SLOP;
export function createTouchPour({ pour, probe, end, undo = () => {}, begin = () => {}, setTimer = setTimeout, clearTimer = clearTimeout, moved = movedPastSlop }) {
  let mode = 'idle', sx = 0, sy = 0, timer = 0, movedAway = false;
  const stop = () => { if (timer) { clearTimer(timer); timer = 0; } };
  return {
    get mode() { return mode; },
    down(x, y) {
      stop(); mode = 'pending'; sx = x; sy = y; movedAway = false;
      begin();
      pour(x, y);
      timer = setTimer(() => { timer = 0; if (mode === 'pending' && !movedAway) { mode = 'probe'; probe(sx, sy); } }, LONG_PRESS_MS);
    },
    move(x, y) {
      if (mode === 'pending' || mode === 'pour') {
        if (!movedAway && !moved(x - sx, y - sy)) return;
        if (!movedAway) { movedAway = true; stop(); mode = 'pour'; }
        pour(x, y);
      } else if (mode === 'probe') probe(x, y);
    },
    up() {
      stop();
      if (mode === 'cancelled') { mode = 'idle'; return; }
      mode = 'idle'; end();
    },
    cancel() {
      stop();
      if (mode === 'idle' || mode === 'cancelled') return;
      mode = 'cancelled';
      undo();
    },
  };
}

// Midpoint velocity in CSS px per ms. A gap means the fingers rested, so the glide starts from rest.
export function sampleVelocity(prev, x, y, time) {
  if (!prev || !(time > prev.lt) || time - prev.lt > 80) return { x: 0, y: 0, lx: x, ly: y, lt: time };
  const dt = time - prev.lt;
  const instX = (x - prev.lx) / dt, instY = (y - prev.ly) / dt;
  return { x: prev.x * 0.55 + instX * 0.45, y: prev.y * 0.55 + instY * 0.45, lx: x, ly: y, lt: time };
}

// Two-finger pan keeps moving after the fingers lift, then dies out. The page pans through the camera clamp.
export function createGlide({ pan, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame }) {
  let raf = 0, vx = 0, vy = 0, t = 0;
  const step = (time) => {
    // A frame timestamp can sit behind performance.now(). Treat that as one frame of glide
    // so the velocity still decays instead of coasting forever.
    const dt = t ? Math.min(34, time - t) : 16;
    const stepDt = dt > 0 ? dt : 16;
    t = time;
    let moved = true;
    try { moved = pan(vx * stepDt, vy * stepDt) !== false; }
    catch (e) { raf = 0; vx = 0; vy = 0; return; }
    const decay = Math.pow(0.9, stepDt / (1000 / 60));
    vx *= decay; vy *= decay;
    if (!moved || !(Math.hypot(vx, vy) >= 0.015)) { raf = 0; vx = 0; vy = 0; return; }
    raf = requestFrame(step);
  };
  return {
    get moving() { return raf !== 0; },
    stop() { if (raf) cancelFrame(raf); raf = 0; vx = 0; vy = 0; },
    kick(x, y) {
      if (!(Math.hypot(x, y) >= 0.02)) return;
      vx = x; vy = y; t = 0;
      if (!raf) raf = requestFrame(step);
    },
  };
}
