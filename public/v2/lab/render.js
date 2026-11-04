import { W, H, NAMES, KIND } from '../engine/world.js';

// Linear-light optics: Beer–Lambert transmission and Schlick's dielectric Fresnel.
// Thickness is measured in grid cells, not metres; this is a stylized 2D section.
export const transmission = (absorption, thickness) => Math.exp(-Math.max(0, absorption) * Math.max(0, thickness));
export function fresnel(cosine, ior = 1.333) {
  const f0 = ((ior - 1) / (ior + 1)) ** 2;
  return f0 + (1 - f0) * (1 - Math.max(0, Math.min(1, cosine))) ** 5;
}
const linear = new Float32Array(256);
for (let i = 0; i < 256; i++) linear[i] = i / 255 <= 0.04045 ? i / 3294.6 : ((i / 255 + 0.055) / 1.055) ** 2.4;
const display = new Uint8Array(4097);
for (let i = 0; i <= 4096; i++) {
  const v = i / 4096;
  display[i] = Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
}
const encode = value => display[Math.max(0, Math.min(4096, Math.round(value * 4096)))];
const environment = [0.38, 0.62, 0.84];
const metals = new Set(['copper', 'steel', 'tungsten', 'mercury', 'gold', 'lead', 'ferrofluid', 'magnet']);
const transparent = new Set(['water', 'brine', 'glass', 'ice', 'crystal', 'aerogel', 'liquid nitrogen']);
const hotColor = value => {
  const t = Math.max(0, Math.min(1, value));
  return [Math.min(1, Math.max(0, t * 3 - 0.7)), Math.max(0, Math.min(1, 1.6 - Math.abs(t - 0.63) * 3.3)), Math.max(0, 1 - t * 1.5)];
};

export function createLabRenderer(canvas) {
  canvas.width = W; canvas.height = H;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This browser cannot create the simulation canvas.');
  const frame = context.createImageData(W, H), pixels = frame.data;
  const color = new Uint8Array(W * H * 4), emission = new Uint8Array(color.length), fx = new Uint8Array(color.length);
  const depth = new Uint16Array(W * H);
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = W; glowCanvas.height = H;
  const glowContext = glowCanvas.getContext('2d');
  const glow = glowContext.createImageData(W, H);
  const material = NAMES.map((name, id) => ({ metal: metals.has(name), clear: transparent.has(name), gas: KIND[id] === 3 }));
  const occupied = (cells, x, y) => x < 0 || x >= W || y < 0 || y >= H ? 1 : (cells[y * W + x] && KIND[cells[y * W + x]] !== 3 ? 1 : 0);

  function render(world, { lens = 'natural', time = 0 } = {}) {
    const state = world.inspect(), { cells, heat, VX, VY } = state;
    world.render(color, emission, fx, Math.floor(time * 60));
    let hasGlow = false;
    for (let y = 0; y < H; y++) {
      const background = [0.004 + 0.004 * y / H, 0.013 + 0.007 * y / H, 0.028 + 0.008 * y / H];
      for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 4, m = cells[i], mat = material[m];
      depth[i] = m && y > 0 && cells[i - W] === m ? Math.min(40, depth[i - W] + 1) : 1;
      pixels[o + 3] = 255;
      if (lens === 'heat' || lens === 'velocity') {
        const q = lens === 'heat' ? heat[i] / 255 : Math.min(1, Math.hypot(VX[i], VY[i]) / 8);
        const c = hotColor(q), scale = m ? 1 : (lens === 'heat' ? 0.22 : 0.06);
        pixels[o] = c[0] * 255 * scale; pixels[o + 1] = c[1] * 255 * scale; pixels[o + 2] = c[2] * 255 * scale;
        continue;
      }
      if (!m) {
        for (let c = 0; c < 3; c++) pixels[o + c] = encode(background[c] + linear[emission[o + c]] * 0.5);
      } else {
        const nx = occupied(cells, x - 1, y) - occupied(cells, x + 1, y);
        const ny = occupied(cells, x, y - 1) - occupied(cells, x, y + 1);
        const length = Math.hypot(nx, ny, 1.6), cosine = 1.6 / length;
        const diffuse = Math.max(0, (-0.45 * nx - 0.65 * ny + 1.6 * 0.61) / length);
        const neighbors = occupied(cells, x - 1, y) + occupied(cells, x + 1, y) + occupied(cells, x, y - 1) + occupied(cells, x, y + 1);
        const shade = (0.53 + diffuse * 0.66) * (1 - neighbors * 0.035);
        const reflection = mat.metal ? 0.1 + (1 - cosine) * 0.5 : (mat.clear ? fresnel(cosine) : 0);
        const trans = mat.clear ? transmission(0.045, depth[i]) * 0.42 : (mat.gas ? 0.4 : 0);
        for (let c = 0; c < 3; c++) {
          const reflected = environment[c] * reflection;
          const surface = linear[color[o + c]] * shade * (1 - reflection);
          pixels[o + c] = encode(surface * (1 - trans) + background[c] * trans + reflected + linear[emission[o + c]] * 0.85);
        }
      }
      const energy = Math.max(emission[o], emission[o + 1], emission[o + 2]);
      glow.data[o] = emission[o]; glow.data[o + 1] = emission[o + 1]; glow.data[o + 2] = emission[o + 2]; glow.data[o + 3] = energy > 40 ? 150 : 0;
      hasGlow ||= energy > 40;
      }
    }
    context.putImageData(frame, 0, 0);
    if (lens === 'natural' && hasGlow) {
      glowContext.putImageData(glow, 0, 0);
      context.save(); context.globalCompositeOperation = 'screen'; context.globalAlpha = 0.45;
      context.filter = 'blur(4px)'; context.drawImage(glowCanvas, 0, 0); context.restore();
    }
    if (lens === 'velocity') {
      context.save(); context.strokeStyle = '#ecf6ff'; context.globalAlpha = 0.7; context.lineWidth = 0.7;
      context.beginPath();
      for (let y = 5; y < H; y += 10) for (let x = 5; x < W; x += 10) {
        const i = y * W + x, speed = Math.hypot(VX[i], VY[i]);
        if (!cells[i] || speed < 0.15) continue;
        const scale = Math.min(7, speed * 2) / speed, dx = VX[i] * scale, dy = VY[i] * scale;
        context.moveTo(x, y); context.lineTo(x + dx, y + dy);
        context.lineTo(x + dx - dx * 0.3 + dy * 0.25, y + dy - dy * 0.3 - dx * 0.25);
      }
      context.stroke(); context.restore();
    }
  }
  return { render, resize() {}, dispose() { glowCanvas.width = 0; glowCanvas.height = 0; } };
}
