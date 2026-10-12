const W = 480,
  H = 270,
  STEP = 1000 / 60;
function clamp(view) {
  const sw = W * view.scale,
    sh = H * view.scale;
  view.x =
    sw <= view.width ? (view.width - sw) / 2 : Math.min(0, Math.max(view.width - sw, view.x));
  view.y =
    sh <= view.height ? (view.height - sh) / 2 : Math.min(0, Math.max(view.height - sh, view.y));
  return view;
}
export function createView(width, height, close = false) {
  const fit = Math.min(width / W, height / H);
  const scale = close ? Math.max(fit, Math.min(height / H, width / 230)) : fit;
  return clamp({
    width,
    height,
    fit,
    scale,
    x: width / 2 - 245 * scale,
    y: height / 2 - 135 * scale,
  });
}
export function worldPoint(view, x, y) {
  const wx = (x - view.x) / view.scale,
    wy = (y - view.y) / view.scale;
  return wx < 0 || wy < 0 || wx >= W || wy >= H ? null : { x: wx, y: wy };
}
export function zoomView(view, factor, x, y) {
  const old = view.scale;
  view.scale = Math.max(view.fit, Math.min(view.fit * 5, old * factor));
  view.x = x - ((x - view.x) * view.scale) / old;
  view.y = y - ((y - view.y) * view.scale) / old;
  return clamp(view);
}
export function panView(view, dx, dy) {
  view.x += dx;
  view.y += dy;
  return clamp(view);
}
export function advanceClock(clock, dt, paused, hidden) {
  if (paused || hidden) {
    clock.acc = 0;
    return 0;
  }
  clock.acc += Math.min(48, Math.max(0, Number.isFinite(dt) ? dt : 0));
  const steps = Math.min(3, Math.floor(clock.acc / STEP));
  clock.acc -= steps * STEP;
  return steps;
}

export function createStroke() {
  let start = 0,
    wait = 0,
    pending = false,
    started = false;
  return {
    begin(now, delay = 0) {
      start = now;
      wait = delay;
      pending = true;
      started = false;
    },
    sample(now) {
      if (!pending || now - start < wait) return false;
      started = true;
      return true;
    },
    finish() {
      const dab = pending && !started;
      pending = false;
      return dab;
    },
    cancel() {
      pending = false;
    },
  };
}
