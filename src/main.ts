import { Grid } from './grid';
import { Renderer } from './render';
import { Material, MATERIALS, STARTER, TRANSMUTED, type MaterialId } from './materials';
import { consumeBlast, step } from './sim';
import { boom, chime } from './feel';
import { BRUSH_SIZES, HEIGHT, WIDTH, seedVessel } from './world';
import { createRite, rainFromCeiling, type RiteName } from './secrets';
import { whisper } from './codex';
import { createView, panBy, screenToCell, zoomAt } from './view';

function requireEl<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`required DOM node missing: ${selector}`);
  return node;
}

const canvas = requireEl<HTMLCanvasElement>('#stage');
const viewport = requireEl<HTMLDivElement>('#viewport');
const probe = requireEl<HTMLDivElement>('#probe');
const probeName = requireEl<HTMLSpanElement>('#probe .name');
const probeSwatch = requireEl<HTMLSpanElement>('#probe .swatch');
const toolbar = requireEl<HTMLDivElement>('#toolbar');
const hud = requireEl<HTMLDivElement>('#hud');
const curtain = requireEl<HTMLDivElement>('#curtain');
const reticle = requireEl<HTMLDivElement>('#reticle');
const lore = requireEl<HTMLParagraphElement>('#lore');
const title = requireEl<HTMLHeadingElement>('h1');
const codex = requireEl<HTMLParagraphElement>('#codex');

const grid = new Grid(WIDTH, HEIGHT);
seedVessel(grid);
const renderer = new Renderer(canvas, grid);
const rite = createRite();

let brush: MaterialId = Material.Sand;
let brushRadius = 6;
let painting = false;
let lastCell: { x: number; y: number } | null = null;
let paused = false;
let speed = 1;
let lastStar = performance.now();
let view = createView();
let gesture: 'none' | 'paint' | 'probe' | 'pan' = 'none';
let downAt = { x: 0, y: 0, t: 0, cellX: 0, cellY: 0 };
let lastDrag = { x: 0, y: 0 };
const discovered = new Set<MaterialId>(STARTER);
let lastFind = '';

const PALETTE: readonly MaterialId[] = [...STARTER, ...TRANSMUTED];
const SPEEDS = [0.5, 1, 2] as const;

const palette = document.createElement('div');
palette.id = 'palette';
toolbar.append(palette);

const tools = document.createElement('div');
tools.id = 'tools';
toolbar.append(tools);

function markPressed(group: HTMLElement, active: HTMLElement): void {
  for (const other of group.querySelectorAll('button')) {
    other.setAttribute('aria-pressed', String(other === active));
  }
}

function paintButton(button: HTMLButtonElement, id: MaterialId): void {
  const [r, g, b] = MATERIALS[id].color;
  button.style.background = `rgb(${r},${g},${b})`;
  button.style.color = r * 0.3 + g * 0.59 + b * 0.11 > 140 ? '#111318' : '#f2f2f6';
}

const paletteButtons = new Map<MaterialId, HTMLButtonElement>();

for (const id of PALETTE) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = MATERIALS[id].name;
  button.dataset.material = String(id);
  paintButton(button, id);
  button.hidden = !discovered.has(id);
  button.setAttribute('aria-pressed', String(id === brush));
  button.addEventListener('click', () => {
    brush = id;
    markPressed(palette, button);
  });
  palette.append(button);
  paletteButtons.set(id, button);
}

const sizeButtons: HTMLButtonElement[] = [];
for (const size of BRUSH_SIZES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `size ${size}`;
  button.dataset.radius = String(size);
  button.setAttribute('aria-pressed', String(size === brushRadius));
  button.addEventListener('click', () => {
    brushRadius = size;
    markPressed(tools, button);
  });
  tools.append(button);
  sizeButtons.push(button);
}

const pauseButton = document.createElement('button');
pauseButton.type = 'button';
pauseButton.textContent = 'pause';
pauseButton.setAttribute('aria-pressed', 'false');
pauseButton.addEventListener('click', () => setPaused(!paused));
tools.append(pauseButton);

const speedButtons: HTMLButtonElement[] = [];
for (const s of SPEEDS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = s === 1 ? '1×' : s < 1 ? '½×' : '2×';
  button.dataset.speed = String(s);
  button.setAttribute('aria-pressed', String(s === speed));
  button.addEventListener('click', () => {
    speed = s;
    for (const other of speedButtons) {
      other.setAttribute('aria-pressed', String(other === button));
    }
  });
  tools.append(button);
  speedButtons.push(button);
}

const clearButton = document.createElement('button');
clearButton.type = 'button';
clearButton.textContent = 'clear';
clearButton.addEventListener('click', () => {
  grid.clear();
});
tools.append(clearButton);

const resetButton = document.createElement('button');
resetButton.type = 'button';
resetButton.textContent = 'reset';
resetButton.addEventListener('click', () => {
  grid.clear();
  seedVessel(grid);
});
tools.append(resetButton);

function setPaused(next: boolean): void {
  paused = next;
  pauseButton.textContent = paused ? 'play' : 'pause';
  pauseButton.setAttribute('aria-pressed', String(paused));
  viewport.classList.toggle('is-still', paused);
}

function selectBrush(id: MaterialId): void {
  const button = paletteButtons.get(id);
  if (!button || button.hidden) return;
  brush = id;
  markPressed(palette, button);
}

function selectRadius(size: number): void {
  brushRadius = size;
  const button = sizeButtons.find((b) => Number(b.dataset.radius) === size);
  if (button) markPressed(tools, button);
}

function reveal(id: MaterialId, note?: string): void {
  if (discovered.has(id)) return;
  discovered.add(id);
  lastFind = MATERIALS[id].name;
  const button = paletteButtons.get(id);
  if (button) button.hidden = false;
  const line = note ?? whisper(id);
  if (line) codex.textContent = line;
  chime();
}

function unlockTransmuted(): void {
  const seen = grid.occupancy();
  for (const id of TRANSMUTED) {
    if (discovered.has(id) || seen[id] === 0) continue;
    reveal(id);
  }
  const opus = seen[Material.Azoth] === 1;
  renderer.setWonder(opus);
  title.classList.toggle('opus', opus);
  if (opus) lore.textContent = 'The Magnum Opus is in the glass. Lead kneels.';
}

function viewportBox(): { vw: number; vh: number; left: number; top: number } {
  const rect = viewport.getBoundingClientRect();
  return { vw: rect.width, vh: rect.height, left: rect.left, top: rect.top };
}

function applyView(): void {
  canvas.style.transform = `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
}

function cellFromPointer(event: PointerEvent): { x: number; y: number } {
  const { vw, vh, left, top } = viewportBox();
  return screenToCell(view, event.clientX - left, event.clientY - top, vw, vh, WIDTH, HEIGHT);
}

function showProbe(cellX: number, cellY: number, clientX: number, clientY: number): void {
  const id = grid.get(cellX, cellY);
  const info = MATERIALS[id];
  probeName.textContent = info.name;
  const [r, g, b] = info.color;
  probeSwatch.style.background = `rgb(${r},${g},${b})`;
  const { vw, vh, left, top } = viewportBox();
  let px = clientX - left + 14;
  let py = clientY - top + 16;
  if (px + 130 > vw) px = clientX - left - 118;
  if (py + 30 > vh) py = clientY - top - 34;
  probe.style.left = `${px}px`;
  probe.style.top = `${py}px`;
  probe.classList.add('is-on');
}

function pourAt(x: number, y: number): void {
  if (lastCell) grid.paintLine(lastCell.x, lastCell.y, x, y, brushRadius, brush);
  else grid.paint(x, y, brushRadius, brush);
  lastCell = { x, y };
}

function eyedrop(x: number, y: number): void {
  const id = grid.get(x, y);
  if (id === Material.Air) {
    brush = Material.Air;
    const air = paletteButtons.get(Material.Air);
    if (air) markPressed(palette, air);
    return;
  }
  reveal(id);
  selectBrush(id);
}

function capturePointer(event: PointerEvent): void {
  const node = event.currentTarget;
  if (!(node instanceof HTMLElement)) return;
  try {
    node.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic or already-released pointers still paint.
  }
}

function releasePointer(event: PointerEvent): void {
  const node = event.currentTarget;
  if (!(node instanceof HTMLElement)) return;
  try {
    node.releasePointerCapture(event.pointerId);
  } catch {
    // Capture may already be gone.
  }
}

viewport.addEventListener('contextmenu', (event) => event.preventDefault());
viewport.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    const { vw, vh, left, top } = viewportBox();
    const factor = Math.exp(-event.deltaY * 0.0016);
    view = zoomAt(view, event.clientX - left, event.clientY - top, factor, vw, vh);
    applyView();
  },
  { passive: false },
);
viewport.addEventListener('dblclick', (event) => {
  if (event.button !== 0) return;
  view = createView();
  applyView();
});

viewport.addEventListener('pointerdown', (event) => {
  const { x, y } = cellFromPointer(event);
  if (event.button === 1 || (event.button === 0 && event.altKey)) {
    eyedrop(x, y);
    return;
  }
  if (event.button === 2) {
    gesture = 'probe';
    downAt = { x: event.clientX, y: event.clientY, t: performance.now(), cellX: x, cellY: y };
    lastDrag = { x: event.clientX, y: event.clientY };
    showProbe(x, y, event.clientX, event.clientY);
    capturePointer(event);
    return;
  }
  if (event.button !== 0) return;
  gesture = 'paint';
  painting = true;
  lastCell = null;
  probe.classList.remove('is-on');
  capturePointer(event);
  pourAt(x, y);
});
viewport.addEventListener('pointermove', (event) => {
  if (gesture === 'pan' || gesture === 'probe') {
    if (gesture === 'probe') {
      const dist = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
      if (dist > 5) gesture = 'pan';
      else return;
    }
    const { vw, vh } = viewportBox();
    view = panBy(view, event.clientX - lastDrag.x, event.clientY - lastDrag.y, vw, vh);
    lastDrag = { x: event.clientX, y: event.clientY };
    applyView();
    const { x, y } = cellFromPointer(event);
    showProbe(x, y, event.clientX, event.clientY);
    return;
  }
  if (gesture === 'paint' || painting) {
    const { x, y } = cellFromPointer(event);
    pourAt(x, y);
  }
}, { capture: true });
function endPaint(event: PointerEvent): void {
  gesture = 'none';
  painting = false;
  lastCell = null;
  releasePointer(event);
}
viewport.addEventListener('pointerup', endPaint);
viewport.addEventListener('pointercancel', endPaint);
viewport.addEventListener('pointerleave', () => {
  if (gesture === 'none') probe.classList.remove('is-on');
});

function enact(name: RiteName): void {
  if (name === 'aether-rain') {
    rainFromCeiling(grid, Material.Aether, 28);
    reveal(Material.Aether, 'Seven knocks. The ceiling remembers stars.');
    return;
  }
  if (name === 'gold-rain') {
    rainFromCeiling(grid, Material.Gold, 24);
    reveal(Material.Gold, 'The old sequence. Kings fall as dust.');
    return;
  }
  if (name === 'void-gift') {
    rainFromCeiling(grid, Material.Void, 6);
    reveal(Material.Void, 'Nigredo. Putrefaction is a door.');
    return;
  }
  rainFromCeiling(grid, Material.Mercury, 12);
  reveal(Material.Mercury, 'Hermes. The living silver answers.');
}

title.tabIndex = 0;
title.addEventListener('click', () => {
  const name = rite.titleClick();
  if (name) enact(name);
});

window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    return;
  }
  const gift = rite.key(event.key);
  if (gift) {
    event.preventDefault();
    enact(gift);
    return;
  }
  if (event.code === 'Space') {
    if (target instanceof HTMLButtonElement) return;
    event.preventDefault();
    setPaused(!paused);
    return;
  }
  if (event.key === '[') {
    const i = BRUSH_SIZES.indexOf(brushRadius as (typeof BRUSH_SIZES)[number]);
    selectRadius(BRUSH_SIZES[Math.max(0, (i === -1 ? 0 : i) - 1)]);
    return;
  }
  if (event.key === ']') {
    const i = BRUSH_SIZES.indexOf(brushRadius as (typeof BRUSH_SIZES)[number]);
    selectRadius(BRUSH_SIZES[Math.min(BRUSH_SIZES.length - 1, (i === -1 ? 0 : i) + 1)]);
    return;
  }
  const digit = event.key === '0' ? 10 : Number(event.key);
  if (digit >= 1 && digit <= 10) {
    const id = STARTER[digit - 1];
    if (id !== undefined) selectBrush(id);
  }
});

function liftCurtain(): void {
  curtain.classList.add('gone');
}
curtain.addEventListener('click', liftCurtain);
window.setTimeout(liftCurtain, 2200);

viewport.addEventListener('pointermove', (event) => {
  const { left, top } = viewportBox();
  reticle.style.left = `${event.clientX - left}px`;
  reticle.style.top = `${event.clientY - top}px`;
  reticle.classList.add('is-on');
});
viewport.addEventListener('pointerleave', () => {
  reticle.classList.remove('is-on');
});

let frames = 0;
let lastSample = performance.now();
let lastTick = performance.now();
let acc = 0;
const STEP_MS = 1000 / 60;

function frame(now: number): void {
  const dt = Math.min(48, now - lastTick);
  lastTick = now;
  if (painting && lastCell) grid.paint(lastCell.x, lastCell.y, brushRadius, brush);

  if (!paused) {
    acc += dt * speed;
    let steps = 0;
    while (acc >= STEP_MS && steps < 3) {
      step(grid);
      acc -= STEP_MS;
      steps++;
    }
    const kick = consumeBlast();
    if (kick > 0) {
      renderer.kick(Math.min(1, kick / 6));
      boom(kick);
    }
    if (now - lastStar > 45000) {
      lastStar = now;
      rainFromCeiling(grid, Material.Ember, 1);
    }
  }

  unlockTransmuted();
  renderer.draw();

  frames++;
  if (now - lastSample >= 500) {
    const fps = (frames * 1000) / (now - lastSample);
    const find = lastFind ? ` · found ${lastFind}` : '';
    const halt = paused ? ' · paused' : '';
    const rate = speed === 1 ? '' : ` · ${speed}×`;
    const z = view.zoom === 1 ? '' : ` · ${view.zoom.toFixed(1)}×`;
    hud.textContent = `${WIDTH}×${HEIGHT} · ${fps.toFixed(0)} fps · ${MATERIALS[brush].name} · size ${brushRadius}${rate}${z}${halt}${find}`;
    frames = 0;
    lastSample = now;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
