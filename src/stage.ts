import * as THREE from 'three';
import { Grid } from './grid';

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform vec2 uGrid;
uniform float uTime;
uniform float uGlow;
uniform float uWonder;
in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 texel = 1.0 / uGrid;
  vec3 probe = texture(uMap, vUv).rgb;
  float heat = max(probe.r - probe.b * 0.88 - 0.16, 0.0);
  float wet = max(probe.b - probe.r * 0.65 - 0.12, 0.0);

  vec2 uv = vUv;
  uv.x += sin(vUv.y * 28.0 + uTime * 0.09) * heat * 0.0035 * uGlow;
  uv.y += cos(vUv.x * 22.0 + uTime * 0.07) * heat * 0.002 * uGlow;

  vec3 c = texture(uMap, uv).rgb;

  vec3 glow = vec3(0.0);
  float heatSum = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j)) * texel * 2.2;
      vec3 n = texture(uMap, uv + o).rgb;
      float h = max(n.r - n.b * 0.88 - 0.16, 0.0);
      float w = max(1.0 - length(vec2(float(i), float(j))) / 2.1, 0.0);
      glow += n * h * w;
      heatSum += h * w;
    }
  }
  c += glow * (0.28 * uGlow);
  c += vec3(0.55, 0.16, 0.03) * heatSum * 0.07 * uGlow;

  float caustic = sin((uv.x * uGrid.x) * 0.37 + uTime * 0.11) *
                  sin((uv.y * uGrid.y) * 0.51 - uTime * 0.09);
  c += wet * caustic * uGlow * vec3(0.08, 0.16, 0.28);

  float gold = max(c.r - 0.48, 0.0) * max(c.g - 0.32, 0.0) * (1.0 - c.b);
  float spark = step(0.92, hash(floor(uv * uGrid) + floor(uTime * 0.25)));
  c += gold * spark * 0.45 * uGlow * vec3(1.0, 0.85, 0.35);

  float aether = max(c.b - 0.55, 0.0) * max(c.g - 0.4, 0.0);
  c += aether * 0.12 * uGlow * vec3(0.2, 0.55, 1.0);

  vec2 p = vUv * 2.0 - 1.0;
  p.x *= 1.06;
  float vig = 1.0 - dot(p, p) * 0.22;
  c *= vig;

  float dark = 1.0 - smoothstep(0.0, 0.22, dot(c, vec3(0.33)));
  float mote = step(0.99955, hash(floor(uv * uGrid * 0.35) + vec2(uTime * 0.003, 0.0)));
  c += dark * mote * 0.1 * uGlow;

  c += uWonder * vec3(0.16, 0.05, 0.22) * (0.45 + 0.55 * sin(vUv.x * 7.0 + uTime * 0.04));
  c += uWonder * vec3(0.05, 0.12, 0.18) * (0.5 + 0.5 * sin(vUv.y * 5.0 - uTime * 0.03));

  float g = hash(uv * uGrid + uTime);
  c += (g - 0.5) * 0.03 * uGlow;

  fragColor = vec4(c, 1.0);
}
`;

/**
 * Display path for the vessel: Three.js nearest-neighbour upscale with heat
 * bloom, water caustics, and a Magnum Opus aurora when WebGL is available.
 */
export class Stage {
  private readonly canvas: HTMLCanvasElement;
  private readonly grid: Grid;
  private gl: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private tex: THREE.DataTexture | null = null;
  private texData: Uint8Array | null = null;
  private uniforms: {
    uMap: { value: THREE.DataTexture };
    uGrid: { value: THREE.Vector2 };
    uTime: { value: number };
    uGlow: { value: number };
    uWonder: { value: number };
  } | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private image: ImageData | null = null;
  private viewW = 0;
  private viewH = 0;

  constructor(canvas: HTMLCanvasElement, grid: Grid) {
    this.canvas = canvas;
    this.grid = grid;
    try {
      this.initGl();
    } catch {
      this.init2d();
    }
  }

  private initGl(): void {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x0e0c12, 1);
    renderer.debug.checkShaderErrors = true;

    const texData = new Uint8Array(this.grid.width * this.grid.height * 4);
    const tex = new THREE.DataTexture(texData, this.grid.width, this.grid.height);
    tex.flipY = true;
    tex.needsUpdate = true;
    tex.colorSpace = THREE.NoColorSpace;
    this.texData = texData;

    const uniforms = {
      uMap: { value: tex },
      uGrid: { value: new THREE.Vector2(this.grid.width, this.grid.height) },
      uTime: { value: 0 },
      uGlow: { value: 1 },
      uWonder: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      glslVersion: THREE.GLSL3,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.gl = renderer;
    this.scene = scene;
    this.camera = camera;
    this.tex = tex;
    this.uniforms = uniforms;
    this.syncSize();
  }

  private init2d(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.canvas.width = this.grid.width;
    this.canvas.height = this.grid.height;
    this.ctx = ctx;
    this.image = ctx.createImageData(this.grid.width, this.grid.height);
  }

  private syncSize(): void {
    if (!this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight));
    if (w === this.viewW && h === this.viewH) return;
    this.viewW = w;
    this.viewH = h;
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
  }

  present(pixels: Uint8ClampedArray, glow: number, wonder = 0): void {
    if (this.gl && this.tex && this.texData && this.uniforms && this.scene && this.camera) {
      this.texData.set(pixels);
      this.tex.needsUpdate = true;
      this.uniforms.uTime.value += 1;
      this.uniforms.uGlow.value = glow;
      this.uniforms.uWonder.value = wonder;
      this.syncSize();
      this.gl.render(this.scene, this.camera);
      return;
    }
    if (this.ctx && this.image) {
      this.image.data.set(pixels);
      this.ctx.putImageData(this.image, 0, 0);
    }
  }
}
