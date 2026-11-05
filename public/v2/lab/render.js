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
const environment = [0.42, 0.29, 0.16];
const metals = new Set(['copper', 'steel', 'tungsten', 'mercury', 'gold', 'lead', 'ferrofluid', 'magnet']);
const transparent = new Set(['water', 'brine', 'glass', 'ice', 'crystal', 'aerogel', 'liquid nitrogen']);
const hash = (x, y, seed) => {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
};
const hotColor = value => {
  const t = Math.max(0, Math.min(1, value));
  return [Math.min(1, Math.max(0, t * 3 - 0.7)), Math.max(0, Math.min(1, 1.6 - Math.abs(t - 0.63) * 3.3)), Math.max(0, 1 - t * 1.5)];
};
const causticTint = [0.35, 0.55, 0.85];
const sparkleTint = [1, 0.78, 0.3];
const backgroundR = new Float32Array(H), backgroundG = new Float32Array(H), backgroundB = new Float32Array(H);
const hazeRows = new Float32Array(H), hazeColumns = new Float32Array(W);
const causticSinX = new Float32Array(W), causticCosX = new Float32Array(W);
const causticSinY = new Float32Array(H), causticCosY = new Float32Array(H);
for (let y = 0; y < H; y++) {
  const vertical = y / H;
  backgroundR[y] = 0.018 + 0.014 * (1 - vertical);
  backgroundG[y] = 0.014 + 0.009 * (1 - vertical);
  backgroundB[y] = 0.017 + 0.010 * vertical;
  hazeRows[y] = Math.exp(-vertical * 3);
  const phase = y * 0.17; causticSinY[y] = Math.sin(phase); causticCosY[y] = Math.cos(phase);
}
for (let x = 0; x < W; x++) {
  const center = (x / W - 0.5) * 2.2;
  hazeColumns[x] = Math.exp(-(center ** 2));
  const phase = x * 0.31; causticSinX[x] = Math.sin(phase); causticCosX[x] = Math.cos(phase);
}

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
  const atmosphereWidth = 120, atmosphereHeight = 68;
  const atmosphereCanvas = document.createElement('canvas');
  atmosphereCanvas.width = atmosphereWidth; atmosphereCanvas.height = atmosphereHeight;
  const atmosphereContext = atmosphereCanvas.getContext('2d');
  const atmosphere = atmosphereContext.createImageData(atmosphereWidth, atmosphereHeight);
  const atmospherePixels = atmosphere.data;
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const material = NAMES.map((name, id) => ({
    metal: metals.has(name), clear: transparent.has(name), gas: KIND[id] === 3,
    glimmer: ['gold', 'azoth', 'aether', 'pearl', 'crystal'].includes(name),
  }));
  const occupied = (cells, x, y) => x < 0 || x >= W || y < 0 || y >= H ? 1 : (cells[y * W + x] && KIND[cells[y * W + x]] !== 3 ? 1 : 0);

  function render(world, { lens = 'natural', time = 0 } = {}) {
    const state = world.inspect(), { cells, heat, VX, VY } = state;
    world.render(color, emission, fx, Math.floor(time * 60));
    if (lens === 'natural') atmospherePixels.fill(0);
    const animationTime = reducedMotion ? 0 : time;
    const phase = animationTime * 1.8, phaseSin = Math.sin(phase), phaseCos = Math.cos(phase);
    const sparkleClock = reducedMotion ? 0 : Math.floor(time * 5);
    let hasGlow = false;
    for (let y = 0; y < H; y++) {
      const background = [backgroundR[y], backgroundG[y], backgroundB[y]];
      for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 4, m = cells[i], mat = material[m];
      const haze = 0.012 * hazeColumns[x] * hazeRows[y];
      background[0] = backgroundR[y] + haze; background[1] = backgroundG[y] + haze * 0.68; background[2] = backgroundB[y] + haze * 0.32;
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
        const sinXY = causticSinX[x] * causticCosY[y] + causticCosX[x] * causticSinY[y];
        const cosXY = causticCosX[x] * causticCosY[y] - causticSinX[x] * causticSinY[y];
        const wave = sinXY * phaseCos + cosXY * phaseSin;
        const shimmer = mat.clear ? 0.014 * Math.max(0, 0.5 + 0.5 * wave) : 0;
        const glint = mat.glimmer && hash(x, y, sparkleClock) > 0.994 ? 0.38 : 0;
        for (let c = 0; c < 3; c++) {
          const reflected = environment[c] * reflection;
          const surface = linear[color[o + c]] * shade * (1 - reflection);
          const caustic = shimmer * causticTint[c];
          const sparkle = glint * sparkleTint[c];
          pixels[o + c] = encode(surface * (1 - trans) + background[c] * trans + reflected + linear[emission[o + c]] * 0.85 + caustic + sparkle);
        }
      }
      const energy = Math.max(emission[o], emission[o + 1], emission[o + 2]);
      glow.data[o] = emission[o]; glow.data[o + 1] = emission[o + 1]; glow.data[o + 2] = emission[o + 2]; glow.data[o + 3] = energy > 40 ? 150 : 0;
      if (lens === 'natural' && energy > 0) {
        const ax = Math.floor(x * atmosphereWidth / W), ay = Math.floor(y * atmosphereHeight / H), ao = (ay * atmosphereWidth + ax) * 4;
        atmospherePixels[ao] = Math.max(atmospherePixels[ao], emission[o]);
        atmospherePixels[ao + 1] = Math.max(atmospherePixels[ao + 1], emission[o + 1]);
        atmospherePixels[ao + 2] = Math.max(atmospherePixels[ao + 2], emission[o + 2]);
        atmospherePixels[ao + 3] = 180;
      }
      hasGlow ||= energy > 40;
      }
    }
    context.putImageData(frame, 0, 0);
    if (lens === 'natural' && hasGlow) {
      atmosphereContext.putImageData(atmosphere, 0, 0);
      context.save(); context.globalCompositeOperation = 'screen'; context.globalAlpha = 0.24;
      context.filter = 'blur(9px)'; context.drawImage(atmosphereCanvas, 0, 0, W, H); context.restore();
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
  return { render, resize() {}, dispose() { glowCanvas.width = 0; glowCanvas.height = 0; atmosphereCanvas.width = 0; atmosphereCanvas.height = 0; } };
}
