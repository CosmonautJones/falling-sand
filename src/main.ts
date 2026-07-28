import { Grid } from './grid';
import { Renderer } from './render';
import { Material, MATERIALS, type MaterialId } from './materials';
import { step } from './sim';

const WIDTH = 240;
const HEIGHT = 160;
const BRUSH_RADIUS = 3;

function require<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`required DOM node missing: ${selector}`);
  return node;
}

const canvas = require<HTMLCanvasElement>('#stage');
const toolbar = require<HTMLDivElement>('#toolbar');
const status = require<HTMLDivElement>('#status');

const grid = new Grid(WIDTH, HEIGHT);
const renderer = new Renderer(canvas, grid);

let brush: MaterialId = Material.Sand;
let painting = false;

const PALETTE: readonly MaterialId[] = [Material.Sand, Material.Water, Material.Stone, Material.Air];

for (const id of PALETTE) {
  const button = document.createElement('button');
  button.textContent = MATERIALS[id].name;
  button.setAttribute('aria-pressed', String(id === brush));
  button.addEventListener('click', () => {
    brush = id;
    for (const other of toolbar.querySelectorAll('button')) {
      other.setAttribute('aria-pressed', String(other === button));
    }
  });
  toolbar.append(button);
}

function cellFromPointer(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor(((event.clientX - rect.left) / rect.width) * WIDTH),
    y: Math.floor(((event.clientY - rect.top) / rect.height) * HEIGHT),
  };
}

canvas.addEventListener('pointerdown', (event) => {
  painting = true;
  canvas.setPointerCapture(event.pointerId);
  const { x, y } = cellFromPointer(event);
  grid.paint(x, y, BRUSH_RADIUS, brush);
});
canvas.addEventListener('pointermove', (event) => {
  if (!painting) return;
  const { x, y } = cellFromPointer(event);
  grid.paint(x, y, BRUSH_RADIUS, brush);
});
canvas.addEventListener('pointerup', (event) => {
  painting = false;
  canvas.releasePointerCapture(event.pointerId);
});

let frames = 0;
let lastSample = performance.now();

function frame(): void {
  step(grid);
  renderer.draw();

  frames++;
  const now = performance.now();
  if (now - lastSample >= 500) {
    const fps = (frames * 1000) / (now - lastSample);
    status.textContent = `${WIDTH}x${HEIGHT} · ${fps.toFixed(0)} fps · brush: ${MATERIALS[brush].name}`;
    frames = 0;
    lastSample = now;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
