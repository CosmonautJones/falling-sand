import * as THREE from 'three';
import { Grid } from './grid';
import { blitOptics, GlowMap } from './optics';

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
uniform sampler2D uOptics;
uniform sampler2D uLight;
uniform vec2 uGrid;
uniform float uTime;
uniform float uGlow;
uniform float uWonder;
uniform float uShake;
in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 emission(vec2 uv) {
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec3(0.0);
  vec4 o = texture(uOptics, uv);
  if (o.a < 0.1) return vec3(0.0);
  if (o.a < 0.5) return vec3(1.0, 0.28, 0.045) * (0.55 + o.r * 0.6);
  if (o.a < 0.8) return vec3(0.16, 0.48, 0.85);
  return vec3(0.62, 0.28, 0.85);
}

void main() {
  vec2 pixel = 1.0 / uGrid;
  vec4 optics = texture(uOptics, vUv);
  float heat = optics.r;
  float wet = optics.g;

  vec2 uv = vUv;
  uv.x += sin(vUv.y * 65.0 - uTime * 0.035) * heat * pixel.x * 1.1 * uGlow;
  uv.y += cos(vUv.x * 48.0 + uTime * 0.025) * heat * pixel.y * 0.25 * uGlow;
  if (uShake > 0.001) {
    uv += (vec2(hash(vec2(uTime, 2.1)), hash(vec2(uTime, 7.7))) - 0.5) * uShake * 0.014;
  }

  vec3 c = texture(uMap, uv).rgb;

  // Local optical bloom at grain resolution. This is light spill, not a
  // physical ray tracer: it never changes temperature or simulation state.
  vec3 spill = texture(uLight, vUv).rgb;
  c += spill * (0.65 + optics.b * 0.35 + uWonder * 0.10);
  c += emission(vUv) * 0.10;

  vec2 cell = vUv * uGrid;
  float weave = sin(cell.x * 0.51 + cell.y * 0.24 + uTime * 0.018)
              + sin(cell.x * -0.32 + cell.y * 0.47 - uTime * 0.014);
  float caustic = pow(max(0.0, 1.0 - abs(weave)), 7.0);
  float surface = wet * (1.0 - texture(uOptics, vUv + vec2(0.0, pixel.y)).g);
  c += wet * caustic * vec3(0.035, 0.10, 0.13);
  c += surface * vec3(0.10, 0.22, 0.24);

  float edge = optics.b * (1.0 - texture(uOptics, vUv + vec2(0.0, pixel.y)).b);
  float glint = pow(max(0.0, sin(uTime * 0.025 + cell.x * 0.31 + cell.y * 0.19)), 24.0);
  glint *= step(0.92, hash(floor(cell))) * uGlow;
  c += edge * vec3(0.07, 0.11, 0.13);
  c += optics.b * glint * vec3(0.30, 0.28, 0.21);

  vec2 p = vUv * 2.0 - 1.0;
  p.x *= 1.06;
  c *= 1.0 - dot(p, p) * 0.12;

  if (uShake > 0.001) {
    c += vec3(1.0, 0.62, 0.28) * uShake * 0.09;
    float ca = uShake * 0.0035;
    c.r = mix(c.r, texture(uMap, uv + vec2(ca, 0.0)).r, 0.55 * uShake);
    c.b = mix(c.b, texture(uMap, uv - vec2(ca, 0.0)).b, 0.55 * uShake);
  }

  fragColor = vec4(c, 1.0);
}
`;

/**
 * Display path: shade at grain resolution, CSS nearest-neighbour upscale.
 * Chrome then composites a 480×270 buffer instead of a 4K fragment storm.
 */
export class Stage {
  private readonly canvas: HTMLCanvasElement;
  private readonly grid: Grid;
  private gl: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private tex: THREE.DataTexture | null = null;
  private texData: Uint8Array | null = null;
  private optics: THREE.DataTexture | null = null;
  private opticsData: Uint8Array | null = null;
  private light: THREE.DataTexture | null = null;
  private glowMap: GlowMap | null = null;
  private uniforms: {
    uMap: { value: THREE.DataTexture };
    uOptics: { value: THREE.DataTexture };
    uLight: { value: THREE.DataTexture };
    uGrid: { value: THREE.Vector2 };
    uTime: { value: number };
    uGlow: { value: number };
    uWonder: { value: number };
    uShake: { value: number };
  } | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private image: ImageData | null = null;

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
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      context: gl ?? undefined,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      depth: false,
      stencil: false,
    });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x0e0c12, 1);
    renderer.debug.checkShaderErrors = true;
    renderer.setPixelRatio(1);
    renderer.setSize(this.grid.width, this.grid.height, false);

    const texData = new Uint8Array(this.grid.width * this.grid.height * 4);
    const tex = new THREE.DataTexture(texData, this.grid.width, this.grid.height);
    tex.flipY = true;
    tex.needsUpdate = true;
    tex.colorSpace = THREE.NoColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    this.texData = texData;

    const opticsData = new Uint8Array(this.grid.width * this.grid.height * 4);
    const optics = new THREE.DataTexture(opticsData, this.grid.width, this.grid.height);
    optics.flipY = true;
    optics.colorSpace = THREE.NoColorSpace;
    optics.magFilter = THREE.NearestFilter;
    optics.minFilter = THREE.NearestFilter;
    optics.generateMipmaps = false;
    this.optics = optics;
    this.opticsData = opticsData;

    const glowMap = new GlowMap(this.grid);
    const light = new THREE.DataTexture(glowMap.data, glowMap.width, glowMap.height);
    light.flipY = true;
    light.colorSpace = THREE.NoColorSpace;
    light.magFilter = THREE.LinearFilter;
    light.minFilter = THREE.LinearFilter;
    light.generateMipmaps = false;
    this.glowMap = glowMap;
    this.light = light;

    const uniforms = {
      uMap: { value: tex },
      uOptics: { value: optics },
      uLight: { value: light },
      uGrid: { value: new THREE.Vector2(this.grid.width, this.grid.height) },
      uTime: { value: 0 },
      uGlow: { value: 1 },
      uWonder: { value: 0 },
      uShake: { value: 0 },
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
  }

  private init2d(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.canvas.width = this.grid.width;
    this.canvas.height = this.grid.height;
    this.ctx = ctx;
    this.image = ctx.createImageData(this.grid.width, this.grid.height);
  }

  present(pixels: Uint8ClampedArray, glow: number, wonder = 0, shake = 0): void {
    if (this.gl && this.tex && this.texData && this.uniforms && this.scene && this.camera) {
      this.texData.set(pixels);
      this.tex.needsUpdate = true;
      if (this.optics && this.opticsData) {
        blitOptics(this.grid, this.opticsData);
        this.optics.needsUpdate = true;
      }
      if (this.glowMap && this.light) {
        this.glowMap.update();
        this.light.needsUpdate = true;
      }
      if (glow > 0) this.uniforms.uTime.value += 1;
      this.uniforms.uGlow.value = glow;
      this.uniforms.uWonder.value = wonder;
      this.uniforms.uShake.value = shake;
      this.gl.render(this.scene, this.camera);
      return;
    }
    if (this.ctx && this.image) {
      this.image.data.set(pixels);
      this.ctx.putImageData(this.image, 0, 0);
    }
  }
}
