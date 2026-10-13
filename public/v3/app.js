import { createValley, SAVE_KEY, SAVE_LIMIT, stringifyValley, parseValley } from './valley.js';
import { createView, worldPoint, zoomView, panView, advanceClock, createStroke } from './view.js';
import { W, H, N, AIR, STONE, BRICK, PLANT, BLOOM } from '../v2/engine/world.js';
import { parseSeed, seedFromSearch, seedSearch, differentSeed } from './seed.js';
import { TERRAIN_VERSION } from './terrain.js';

const $ = (id) => document.getElementById(id);
const canvas = $('world'),
  ctx = canvas.getContext('2d', { alpha: false });
const cursorRing = document.getElementById('cursor-ring');
const rendererMode = new URLSearchParams(globalThis.location.search).get('renderer');
const gpuPresenter = rendererMode !== 'canvas' && rendererMode !== 'webgl' && globalThis.WebGpuPresenter
  ? new globalThis.WebGpuPresenter(canvas, W, H, {
      onReady: () => { canvas.style.opacity = '0'; needsDraw = true; },
      onLost: () => { canvas.style.opacity = ''; if (cursorRing) cursorRing.style.display = 'none'; needsDraw = true; },
    })
  : null;
gpuPresenter?.start();
const buffer = document.createElement('canvas');
buffer.width = W;
buffer.height = H;
const pixels = buffer.getContext('2d');
const frame = pixels.createImageData(W, H),
  color = frame.data;
const emission = new Uint8Array(N * 4),
  effects = new Uint8Array(N * 4);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let { seed, terrainVersion } = seedFromSearch(location.search);
let valley = createValley({ seed, terrainVersion });
let tool = 'dig',
  size = 1,
  paused = false,
  overview = innerWidth > 760,
  view;
let last = performance.now(),
  lastStats = -1,
  needsDraw = true,
  painted = false;
let cursor = null,
  toastTimer,
  gesture = null;
const clock = { acc: 0 },
  pointers = new Map(),
  sizes = [2, 5, 10],
  sizeNames = ['Fine', 'Medium', 'Wide'];
const stroke = createStroke();
const plantColors = { reed: [112, 167, 103], clover: [151, 186, 98], fireflower: [193, 158, 99] };
const bloomColors = { reed: [211, 216, 132], clover: [211, 216, 132], fireflower: [236, 155, 92] };
const sky = new Uint8ClampedArray(N * 4);

function background() {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4,
        v = y / H;
      const mountain = y > 113 + Math.sin(x / 67 + seed) * 17 + Math.sin(x / 33) * 8;
      sky[o] = mountain ? 28 : 19 + v * 9;
      sky[o + 1] = mountain ? 48 : 34 + v * 11;
      sky[o + 2] = mountain ? 36 : 31 + v * 5;
      // Sparse static lights in the sky, deterministic cosmetic grain, no RNG consumption.
      if (!mountain && y < 95 && (x * 113 + y * 7919 + seed) % 6551 === 0) {
        sky[o] = 123;
        sky[o + 1] = 147;
        sky[o + 2] = 109;
      }
      const sun = (x - 360) ** 2 + (y - 40) ** 2;
      if (sun < 64) {
        sky[o] = 211;
        sky[o + 1] = 216;
        sky[o + 2] = 165;
      }
      sky[o + 3] = 255;
    }
}
function notify(message) {
  $('toast').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $('toast').textContent = '';
  }, 4500);
}
function resize() {
  const rect = canvas.getBoundingClientRect(),
    dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  gpuPresenter?.resize(canvas.width, canvas.height);
  view = createView(rect.width, rect.height, !overview);
  needsDraw = true;
}
function updateSeed() {
  $('seed-label').textContent = `VALLEY ${seed}`;
  $('landform').textContent = valley.inspect().landform.toUpperCase();
  $('seed-input').value = String(seed);
  $('seed-input').removeAttribute('aria-invalid');
  $('seed-error').textContent = '';
  history.replaceState(
    null,
    '',
    `${location.pathname}?${seedSearch(location.search, seed, terrainVersion)}${location.hash}`,
  );
}
function reset(nextSeed, nextVersion = terrainVersion) {
  seed = nextSeed;
  terrainVersion = nextVersion;
  valley = createValley({ seed, terrainVersion });
  clock.acc = 0;
  pointers.clear();
  gesture = null;
  stroke.cancel();
  cursor = null;
  lastStats = -1;
  painted = false;
  needsDraw = true;
  $('field-note').textContent = 'Water stays in the soil. The valley remembers.';
  $('dam').hidden = false;
  $('dam').textContent = 'Break the dam ↘';
  $('hint').innerHTML = 'A dry valley. A full reservoir.<br>See what the water wakes.';
  background();
  updateSeed();
  readStats();
  $('more').open = false;
}
function readStats() {
  const stats = valley.stats();
  $('wet').textContent = stats.wetPatches;
  $('growth').textContent = stats.plantGrains;
  if (painted) {
    $('hint').textContent =
      stats.flowers > 0
        ? 'Fireflowers. A different kind of return.'
        : stats.plantGrains > 80
          ? 'A little water went a long way.'
          : 'Follow the water. The soil keeps it.';
    $('field-note').textContent =
      stats.flowers > 0
        ? 'Burned ground favors fireflowers. Wet ground favors reeds.'
        : 'Try fire on a green patch. Then water what remains.';
  }
  lastStats = stats.tick;
}
function syncCursorRing() {
  if (!cursorRing) return;
  if (!gpuPresenter?.active || !cursor || pointers.size || !view) {
    cursorRing.style.display = 'none';
    return;
  }
  cursorRing.style.display = 'block';
  cursorRing.style.left = `${cursor.x * view.scale + view.x}px`;
  cursorRing.style.top = `${cursor.y * view.scale + view.y}px`;
  const diameter = sizes[size] * 2 * view.scale;
  cursorRing.style.width = `${diameter}px`;
  cursorRing.style.height = `${diameter}px`;
}
function draw() {
  const { world, soil, surface, tick } = valley.inspect();
  valley.render(color, emission, effects, reduced.matches ? 0 : tick);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        o = i * 4,
        m = world.cells[i];
      if (m === AIR) {
        color[o] = sky[o];
        color[o + 1] = sky[o + 1];
        color[o + 2] = sky[o + 2];
      } else if ((m === STONE || m === BRICK) && y >= surface[x]) {
        const q = Math.floor(x / 8),
          depth = y - surface[x],
          shade = world.shades[i];
        const wet = depth < 18 ? soil.water[q] / 80 : 0;
        const strata = depth % 11 === 0 ? -7 : 0;
        color[o] = 78 + shade + strata - wet * 28;
        color[o + 1] = 83 + shade + strata - wet * 9;
        color[o + 2] = 49 + shade + strata + wet * 12;
        if (soil.burn[q] && depth < 4) {
          color[o] = 57 + shade;
          color[o + 1] = 54 + shade;
          color[o + 2] = 41 + shade;
        }
        if (depth === 0) {
          color[o] += 27;
          color[o + 1] += 25;
          color[o + 2] += 12;
        }
      } else if (m === BRICK) {
        color[o] = 110 + world.shades[i];
        color[o + 1] = color[o];
        color[o + 2] = color[o] + 8;
      }
      color[o + 3] = 255;
    }
  for (const plant of soil.plants) {
    if (!plant) continue;
    for (const i of plant.nodes) {
      const m = world.cells[i];
      if (m !== PLANT && m !== BLOOM) continue;
      const o = i * 4,
        s = world.shades[i];
      const rgb = (m === BLOOM ? bloomColors : plantColors)[plant.kind];
      color[o] = rgb[0] + s;
      color[o + 1] = rgb[1] + s;
      color[o + 2] = rgb[2] + s;
    }
  }
  if (gpuPresenter?.active) {
    syncCursorRing();
    gpuPresenter.setView({
      x: view.x,
      y: view.y,
      width: W * view.scale,
      height: H * view.scale,
    });
    gpuPresenter.present(color, reduced.matches ? 0 : tick, 1, 0, 0);
    needsDraw = false;
    return;
  }
  pixels.putImageData(frame, 0, 0);
  const dpr = canvas.width / view.width;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#17261f';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.drawImage(buffer, view.x, view.y, W * view.scale, H * view.scale);
  if (cursor && !pointers.size) {
    ctx.strokeStyle = '#e4e9cfa0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(
      cursor.x * view.scale + view.x,
      cursor.y * view.scale + view.y,
      sizes[size] * view.scale,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  needsDraw = false;
}

// Pointer edits are sampled once per frame. A second finger cancels the pending stroke.
function local(event) {
  const r = canvas.getBoundingClientRect();
  return { x: event.clientX - r.left, y: event.clientY - r.top };
}
function apply(point) {
  const p = worldPoint(view, point.x, point.y);
  if (!p) return;
  valley.applyTool({ tool, x: Math.min(W - 1, p.x), y: Math.min(H - 1, p.y), r: sizes[size] });
  needsDraw = true;
}
function sampleGesture() {
  const [a, b] = [...pointers.values()];
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
  };
}
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, local(event));
  if (pointers.size === 1) stroke.begin(performance.now(), event.pointerType === 'touch' ? 75 : 0);
  if (pointers.size >= 2) {
    stroke.cancel();
    gesture = sampleGesture();
  }
});
canvas.addEventListener('pointermove', (event) => {
  const p = local(event);
  cursor = worldPoint(view, p.x, p.y);
  needsDraw = true;
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, p);
  if (pointers.size >= 2) {
    const next = sampleGesture();
    zoomView(view, next.distance / gesture.distance, gesture.x, gesture.y);
    panView(view, next.x - gesture.x, next.y - gesture.y);
    gesture = next;
  }
});
function release(event) {
  if (!pointers.has(event.pointerId)) return;
  // A quick tap still paints when no animation frame landed between down and up.
  if (pointers.size === 1 && stroke.finish()) apply(local(event));
  pointers.delete(event.pointerId);
  if (!pointers.size) gesture = null;
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', (event) => {
  stroke.cancel();
  pointers.delete(event.pointerId);
});
canvas.addEventListener('lostpointercapture', (event) => {
  if (pointers.has(event.pointerId)) stroke.cancel();
  pointers.delete(event.pointerId);
});
canvas.addEventListener('pointerleave', () => {
  cursor = null;
  needsDraw = true;
});
canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    const p = local(event);
    zoomView(view, Math.exp(-event.deltaY * 0.001), p.x, p.y);
    needsDraw = true;
  },
  { passive: false },
);
canvas.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key))
    return;
  event.preventDefault();
  cursor ??= { x: 245, y: 170 };
  if (event.key === 'Enter' || event.key === ' ')
    valley.applyTool({ tool, ...cursor, r: sizes[size] });
  else {
    cursor.x = Math.max(
      1,
      Math.min(
        W - 2,
        cursor.x + (event.key === 'ArrowRight' ? 4 : event.key === 'ArrowLeft' ? -4 : 0),
      ),
    );
    cursor.y = Math.max(
      1,
      Math.min(
        H - 2,
        cursor.y + (event.key === 'ArrowDown' ? 4 : event.key === 'ArrowUp' ? -4 : 0),
      ),
    );
  }
  needsDraw = true;
});
for (const button of document.querySelectorAll('[data-tool]'))
  button.addEventListener('click', () => {
    tool = button.dataset.tool;
    for (const other of document.querySelectorAll('[data-tool]'))
      other.setAttribute('aria-pressed', String(other === button));
  });
$('size').onclick = () => {
  size = (size + 1) % sizes.length;
  $('size-label').textContent = sizeNames[size];
  $('size').setAttribute('aria-label', `Brush size: ${sizeNames[size].toLowerCase()}`);
  needsDraw = true;
};
$('pause').onclick = () => {
  paused = !paused;
  clock.acc = 0;
  $('pause').textContent = paused ? 'Resume' : 'Pause';
  $('pause').setAttribute('aria-pressed', String(paused));
};
$('view').onclick = () => {
  overview = !overview;
  $('view').textContent = overview ? 'Close view' : 'Overview';
  resize();
};
$('view').textContent = overview ? 'Close view' : 'Overview';
$('dam').onclick = () => {
  valley.openDam();
  painted = true;
  $('dam').hidden = true;
  readStats();
  needsDraw = true;
  notify('The gate is open. Follow the flood.');
};
$('rain').onclick = () => {
  valley.rain();
  needsDraw = true;
  notify('A little rain for the valley.');
};
$('again').onclick = () => {
  reset(seed);
  notify('Same valley. A fresh start.');
};
$('new').onclick = () => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  reset(differentSeed(bytes[0], seed), TERRAIN_VERSION);
  notify('A new landscape, a new experiment.');
};
$('seed-form').onsubmit = (event) => {
  event.preventDefault();
  const next = parseSeed($('seed-input').value);
  if (next === null) {
    $('seed-input').setAttribute('aria-invalid', 'true');
    $('seed-error').textContent = 'Use a whole number from 0 to 4294967295.';
    $('seed-input').focus();
    return;
  }
  // Entering the displayed seed replays this generator, including an imported original valley.
  reset(next, next === seed ? terrainVersion : TERRAIN_VERSION);
  notify('Seed planted. A fresh start.');
};
$('save').onclick = () => {
  try {
    localStorage.setItem(SAVE_KEY, stringifyValley(valley.checkpoint()));
    notify('Valley saved in this browser.');
  } catch {
    notify('Browser storage is full or unavailable. Export a valley file to keep it.');
  }
  $('more').open = false;
};
function load(text) {
  valley.restore(parseValley(text));
  seed = valley.inspect().seed;
  terrainVersion = valley.inspect().terrainVersion;
  background();
  updateSeed();
  clock.acc = 0;
  pointers.clear();
  gesture = null;
  stroke.cancel();
  needsDraw = true;
  lastStats = -1;
  painted = !valley.stats().damIntact;
  $('dam').hidden = painted;
  if (!painted) {
    $('hint').innerHTML = 'A dry valley. A full reservoir.<br>See what the water wakes.';
    $('field-note').textContent = 'Water stays in the soil. The valley remembers.';
  }
  readStats();
  $('more').open = false;
  notify('Your valley is back, soil and all.');
}
$('load').onclick = () => {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) {
      notify('No valley saved here yet.');
      return;
    }
    load(text);
  } catch {
    notify('That save could not be loaded. Your current valley is still here.');
  }
};
$('export').onclick = () => {
  try {
    const url = URL.createObjectURL(
      new Blob([stringifyValley(valley.checkpoint())], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `alembic-valley-${seed}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Valley file exported.');
    $('more').open = false;
  } catch {
    notify('The valley could not be exported. Please try again.');
  }
};
$('import').onchange = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > SAVE_LIMIT) throw new Error('Size limit');
    load(await file.text());
  } catch {
    notify('That file is not a valid valley save. Your valley is still here.');
  } finally {
    event.target.value = '';
  }
};
document.addEventListener('click', (event) => {
  if (!$('more').contains(event.target)) $('more').open = false;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    $('more').open = false;
    $('more').querySelector('summary').focus();
  }
});
document.addEventListener('visibilitychange', () => {
  clock.acc = 0;
  last = performance.now();
  pointers.clear();
  gesture = null;
  stroke.cancel();
});
new ResizeObserver(resize).observe(canvas);
background();
updateSeed();
resize();
readStats();
function animate(now) {
  const steps = advanceClock(clock, now - last, paused, document.hidden);
  last = now;
  if (!document.hidden) {
    if (pointers.size === 1 && stroke.sample(now)) apply(pointers.values().next().value);
    if (steps) {
      valley.advanceTicks(steps);
      needsDraw = true;
    }
    if (valley.inspect().tick - lastStats >= 30) readStats();
    if (needsDraw) draw();
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
