import { Grid } from './grid';
import { Renderer } from './render';
import { Material, MATERIALS, STARTER, TRANSMUTED, type MaterialId } from './materials';
import { beats, consumeBlast, resetSim, step } from './sim';
import { boom, chime } from './feel';
import { BRUSH_SIZES, HEIGHT, WIDTH, seedVessel } from './world';
import { createRite, rainFromCeiling, type RiteName } from './secrets';
import { blanks, stained, whisper } from './codex';
import {
  clampPan,
  createView,
  focusAt,
  panBy,
  pinchBetween,
  screenToCell,
  zoomAt,
  type PinchFrame,
} from './view';
import { mountMobileControls } from './mobile-controls';
import { startVisibleLoop } from './visible-loop';

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
const folio = requireEl<HTMLDialogElement>('#folio');
const folioCount = requireEl<HTMLSpanElement>('#folio-count');
const folioLeaves = requireEl<HTMLOListElement>('#folio-leaves');
const folioShut = requireEl<HTMLButtonElement>('#folio-shut');

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
let view = createView();
let movingView = false;
let activePointer: number | null = null;
const touches = new Map<number, { x: number; y: number }>();
let multiTouch = false;
let lastPointerWasTouch = false;
let lastViewport: { vw: number; vh: number; cw: number; ch: number } | null = null;
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
const sizes = document.createElement('div');
sizes.id = 'brush-sizes';
toolbar.insertBefore(sizes, tools);

function markPressed(group: HTMLElement, active: HTMLElement): void {
  for (const other of group.querySelectorAll('button')) {
    other.setAttribute('aria-pressed', String(other === active));
  }
}

function paintButton(button: HTMLButtonElement, id: MaterialId): void {
  const [r, g, b] = MATERIALS[id].color;
  button.style.background = `rgb(${r},${g},${b})`;
  button.style.setProperty('--material-color', `rgb(${r},${g},${b})`);
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
    selectBrush(id);
  });
  palette.append(button);
  paletteButtons.set(id, button);
}

const sizeButtons: HTMLButtonElement[] = [];
for (const size of BRUSH_SIZES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `size ${size}`;
  const preview = document.createElement('span');
  preview.className = 'brush-preview';
  preview.setAttribute('aria-hidden', 'true');
  preview.style.width = preview.style.height = `${size * 2 + 1}px`;
  button.prepend(preview);
  button.title = `${size * 2 + 1} grains wide`;
  button.dataset.radius = String(size);
  button.setAttribute('aria-pressed', String(size === brushRadius));
  button.addEventListener('click', () => {
    selectRadius(size);
  });
  sizes.append(button);
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
  confirmStartOver('clear');
});
tools.append(clearButton);

const resetButton = document.createElement('button');
resetButton.type = 'button';
resetButton.textContent = 'reset';
resetButton.addEventListener('click', () => {
  confirmStartOver('reset');
});
tools.append(resetButton);

const folioButton = document.createElement('button');
folioButton.type = 'button';
folioButton.textContent = 'codex';
folioButton.setAttribute('aria-expanded', 'false');
folioButton.setAttribute('aria-controls', 'folio');
folioButton.addEventListener('click', () => setFolioOpen(!folio.classList.contains('is-open')));
tools.append(folioButton);

const moveButton = document.createElement('button');
moveButton.type = 'button';
moveButton.textContent = 'move view';
moveButton.setAttribute('aria-pressed', 'false');
moveButton.addEventListener('click', () => setMovingView(!movingView));

function cameraButton(label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

function zoomCenter(factor: number): void {
  const { vw, vh, cw, ch } = viewportBox();
  view = zoomAt(view, vw / 2, vh / 2, factor, vw, vh, cw, ch);
  applyView();
}

function fitVessel(): void {
  cancelGesture();
  const { vw, vh, cw, ch } = viewportBox();
  view = clampPan(createView(), vw, vh, cw, ch);
  applyView();
}

tools.prepend(
  pauseButton,
  moveButton,
  cameraButton('zoom in', () => zoomCenter(1.5)),
  cameraButton('zoom out', () => zoomCenter(1 / 1.5)),
  cameraButton('whole vessel', fitVessel),
);

const mobileControls = mountMobileControls({
  toolbar,
  palette,
  sizes,
  tools,
  pause: pauseButton,
  cancelGesture,
});
syncBrushSummary();

function syncBrushSummary(): void {
  mobileControls.syncBrush(
    MATERIALS[brush].name,
    brushRadius,
    `rgb(${MATERIALS[brush].color.join(',')})`,
  );
}

const resetDialog = requireEl<HTMLDialogElement>('#confirm-reset');
const resetConfirm = requireEl<HTMLButtonElement>('#reset-confirm');
let pendingReset: 'clear' | 'reset' | null = null;
function confirmStartOver(action: 'clear' | 'reset'): void {
  cancelGesture();
  mobileControls.close();
  pendingReset = action;
  requireEl('#reset-title').textContent =
    action === 'clear' ? 'Empty the vessel?' : 'Start a fresh vessel?';
  resetConfirm.textContent = action === 'clear' ? 'Clear vessel' : 'Reset vessel';
  resetDialog.showModal();
}
requireEl('#reset-cancel').addEventListener('click', () => resetDialog.close());
resetConfirm.addEventListener('click', () => {
  if (!pendingReset) return;
  resetSim();
  grid.clear();
  if (pendingReset === 'reset') seedVessel(grid);
  pendingReset = null;
  resetDialog.close();
});
resetDialog.addEventListener('close', () => {
  pendingReset = null;
});

function setMovingView(next: boolean): void {
  movingView = next;
  cancelGesture();
  moveButton.setAttribute('aria-pressed', String(next));
  viewport.classList.toggle('is-moving', next);
}

function cancelGesture(): void {
  const pointers = [...touches.keys()];
  if (activePointer !== null) pointers.push(activePointer);
  touches.clear();
  multiTouch = false;
  painting = false;
  gesture = 'none';
  activePointer = null;
  lastCell = null;
  for (const id of pointers) {
    if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
  }
}

requireEl<HTMLButtonElement>('#first-experiment').addEventListener('click', () => {
  selectBrush(Material.Water);
  const { vw, vh, cw, ch } = viewportBox();
  view = focusAt(
    Math.round(WIDTH * 0.88),
    HEIGHT - 20,
    Math.max(3, vh / ch),
    vw,
    vh,
    WIDTH,
    HEIGHT,
    cw,
    ch,
  );
  applyView();
});
function resizeView(): void {
  cancelGesture();
  const next = viewportBox();
  if (next.vw <= 0 || next.vh <= 0) return;
  if (lastViewport) {
    const old = lastViewport;
    const x = ((old.vw / 2 - view.panX) / (old.cw * view.zoom)) * WIDTH;
    const y = ((old.vh / 2 - view.panY) / (old.ch * view.zoom)) * HEIGHT;
    view = focusAt(x, y, view.zoom, next.vw, next.vh, WIDTH, HEIGHT, next.cw, next.ch);
  } else {
    const zoom = mobileControls.compact.matches && next.vh > next.vw ? next.vh / next.ch : 1;
    view = focusAt(WIDTH / 2, HEIGHT / 2, zoom, next.vw, next.vh, WIDTH, HEIGHT, next.cw, next.ch);
  }
  lastViewport = next;
  applyView();
}
new ResizeObserver(resizeView).observe(viewport);
window.addEventListener('blur', cancelGesture);
resizeView();

function paintFolio(): void {
  const pages = stained(discovered);
  folioCount.textContent = `${pages.length} stained · ${blanks(discovered)} blank`;
  const nodes: HTMLLIElement[] = [];
  for (const leaf of pages) {
    const item = document.createElement('li');
    const heading = document.createElement('h2');
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    const [r, g, b] = MATERIALS[leaf.id].color;
    swatch.style.background = `rgb(${r},${g},${b})`;
    heading.append(swatch, document.createTextNode(MATERIALS[leaf.id].name));
    const line = document.createElement('p');
    line.className = 'whisper';
    line.textContent = leaf.whisper;
    const body = document.createElement('p');
    body.className = 'leaf';
    body.textContent = leaf.leaf;
    item.append(heading, line, body);
    nodes.push(item);
  }
  folioLeaves.replaceChildren(...nodes);
}

function setFolioOpen(open: boolean): void {
  if (open) {
    cancelGesture();
    mobileControls.close();
    paintFolio();
    folio.showModal();
  } else {
    folio.close();
  }
  folio.classList.toggle('is-open', open);
  folio.setAttribute('aria-hidden', String(!open));
  folioButton.setAttribute('aria-expanded', String(open));
}

folioShut.addEventListener('click', () => setFolioOpen(false));
folio.addEventListener('close', () => {
  folio.classList.remove('is-open');
  folio.setAttribute('aria-hidden', 'true');
  folioButton.setAttribute('aria-expanded', 'false');
  (mobileControls.compact.matches ? requireEl<HTMLButtonElement>('#more-menu') : folioButton).focus(
    { preventScroll: true },
  );
});

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
  setMovingView(false);
  syncBrushSummary();
}

function selectRadius(size: number): void {
  brushRadius = size;
  const button = sizeButtons.find((b) => Number(b.dataset.radius) === size);
  if (button) {
    for (const other of sizeButtons) other.setAttribute('aria-pressed', String(other === button));
  }
  syncBrushSummary();
}

function reveal(id: MaterialId, note?: string): void {
  if (discovered.has(id)) return;
  discovered.add(id);
  lastFind = MATERIALS[id].name;
  const button = paletteButtons.get(id);
  if (button) button.hidden = false;
  const line = note ?? whisper(id);
  if (line) codex.textContent = line;
  if (folio.classList.contains('is-open')) paintFolio();
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

function viewportBox(): {
  vw: number;
  vh: number;
  cw: number;
  ch: number;
  left: number;
  top: number;
} {
  const rect = viewport.getBoundingClientRect();
  const cw = Math.min(rect.width, (rect.height * WIDTH) / HEIGHT);
  return {
    vw: rect.width,
    vh: rect.height,
    cw,
    ch: (cw * HEIGHT) / WIDTH,
    left: rect.left,
    top: rect.top,
  };
}

function applyView(): void {
  const { cw, ch } = viewportBox();
  canvas.style.width = `${cw}px`;
  canvas.style.height = `${ch}px`;
  canvas.style.transform = `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
}

function cellFromPointer(event: PointerEvent): { x: number; y: number } {
  const { cw, ch, left, top } = viewportBox();
  return screenToCell(view, event.clientX - left, event.clientY - top, cw, ch, WIDTH, HEIGHT);
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
    selectBrush(Material.Air);
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
    const { vw, vh, cw, ch, left, top } = viewportBox();
    const factor = Math.exp(-event.deltaY * 0.0016);
    view = zoomAt(view, event.clientX - left, event.clientY - top, factor, vw, vh, cw, ch);
    applyView();
  },
  { passive: false },
);
viewport.addEventListener('dblclick', (event) => {
  if (event.button !== 0 || lastPointerWasTouch) return;
  fitVessel();
});

function touchFrame(): PinchFrame | null {
  const pair = [...touches.values()];
  if (pair.length < 2) return null;
  const { left, top } = viewportBox();
  return {
    x: (pair[0].x + pair[1].x) / 2 - left,
    y: (pair[0].y + pair[1].y) / 2 - top,
    distance: Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y),
  };
}

viewport.addEventListener('pointerdown', (event) => {
  if (mobileControls.open || resetDialog.open || folio.classList.contains('is-open')) return;
  lastPointerWasTouch = event.pointerType === 'touch';
  if (lastPointerWasTouch) {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    capturePointer(event);
    if (touches.size > 1 || multiTouch) {
      multiTouch = true;
      painting = false;
      lastCell = null;
      activePointer = null;
      gesture = 'none';
      probe.classList.remove('is-on');
      return;
    }
  }
  if (activePointer !== null) return;
  const { x, y } = cellFromPointer(event);
  if (event.button === 1 || (event.button === 0 && event.altKey)) {
    eyedrop(x, y);
    return;
  }
  activePointer = event.pointerId;
  if (event.button === 2) {
    gesture = 'probe';
    downAt = { x: event.clientX, y: event.clientY, t: performance.now(), cellX: x, cellY: y };
    lastDrag = { x: event.clientX, y: event.clientY };
    showProbe(x, y, event.clientX, event.clientY);
    capturePointer(event);
    return;
  }
  if (event.button !== 0) return;
  if (movingView) {
    gesture = 'pan';
    lastDrag = { x: event.clientX, y: event.clientY };
    probe.classList.remove('is-on');
    capturePointer(event);
    return;
  }
  gesture = 'paint';
  painting = true;
  lastCell = null;
  probe.classList.remove('is-on');
  capturePointer(event);
  pourAt(x, y);
});
viewport.addEventListener(
  'pointermove',
  (event) => {
    if (event.pointerType === 'touch' && touches.has(event.pointerId)) {
      const from = touchFrame();
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const to = touchFrame();
      if (multiTouch) {
        if (from && to) {
          const { vw, vh, cw, ch } = viewportBox();
          view = pinchBetween(view, from, to, vw, vh, cw, ch);
          applyView();
        }
        return;
      }
    }
    if (event.pointerId !== activePointer) return;
    if (gesture === 'pan' || gesture === 'probe') {
      if (gesture === 'probe') {
        const dist = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
        if (dist > 5) gesture = 'pan';
        else return;
      }
      const { vw, vh, cw, ch } = viewportBox();
      view = panBy(view, event.clientX - lastDrag.x, event.clientY - lastDrag.y, vw, vh, cw, ch);
      lastDrag = { x: event.clientX, y: event.clientY };
      applyView();
      const { x, y } = cellFromPointer(event);
      if (!movingView) showProbe(x, y, event.clientX, event.clientY);
      return;
    }
    if (gesture === 'paint' || painting) {
      const { x, y } = cellFromPointer(event);
      pourAt(x, y);
    }
  },
  { capture: true },
);
function endPaint(event: PointerEvent): void {
  touches.delete(event.pointerId);
  if (multiTouch) {
    if (touches.size === 0) multiTouch = false;
    releasePointer(event);
    return;
  }
  if (event.pointerId !== activePointer) return;
  activePointer = null;
  gesture = 'none';
  painting = false;
  lastCell = null;
  releasePointer(event);
}
viewport.addEventListener('pointerup', endPaint);
viewport.addEventListener('pointercancel', endPaint);
viewport.addEventListener('lostpointercapture', endPaint);
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
  if (mobileControls.open || resetDialog.open || folio.open) return;
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  ) {
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
    hud.textContent = `${WIDTH}×${HEIGHT} · ${fps.toFixed(0)} fps · ${beats()} beats · ${MATERIALS[brush].name} · size ${brushRadius}${rate}${z}${halt}${find}`;
    frames = 0;
    lastSample = now;
  }
}

startVisibleLoop({
  frame,
  resume: () => {
    lastTick = performance.now();
    lastSample = lastTick;
    frames = 0;
    acc = 0;
  },
  suspend: () => {
    cancelGesture();
    acc = 0;
    probe.classList.remove('is-on');
    reticle.classList.remove('is-on');
  },
});
