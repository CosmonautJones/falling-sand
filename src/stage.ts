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
uniform float uShake;
in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 probe = texture(uMap, vUv).rgb;
  float heat = max(probe.r - probe.b * 0.88 - 0.16, 0.0);
  float wet = max(probe.b - probe.r * 0.65 - 0.12, 0.0);

  vec2 uv = vUv;
  uv.x += sin(vUv.y * 28.0 + uTime * 0.05) * heat * 0.0012 * uGlow;
  uv.y += cos(vUv.x * 22.0 + uTime * 0.04) * heat * 0.0007 * uGlow;
  if (uShake > 0.001) {
    uv += (vec2(hash(vec2(uTime, 2.1)), hash(vec2(uTime, 7.7))) - 0.5) * uShake * 0.014;
  }

  vec3 c = texture(uMap, uv).rgb;
  c += vec3(0.45, 0.12, 0.03) * heat * 0.12 * uGlow;

  float caustic = sin((uv.x * uGrid.x) * 0.37 + uTime * 0.11) *
                  sin((uv.y * uGrid.y) * 0.51 - uTime * 0.09);
  c += wet * caustic * uGlow * vec3(0.03, 0.06, 0.10);

  float gold = max(c.r - 0.48, 0.0) * max(c.g - 0.32, 0.0) * (1.0 - c.b);
  float spark = step(0.92, hash(floor(uv * uGrid) + floor(uTime * 0.25)));
  c += gold * spark * 0.45 * uGlow * vec3(1.0, 0.85, 0.35);

  float aether = max(c.b - 0.55, 0.0) * max(c.g - 0.4, 0.0);
  c += aether * 0.12 * uGlow * vec3(0.2, 0.55, 1.0);

  vec2 p = vUv * 2.0 - 1.0;
  p.x *= 1.06;
  c *= 1.0 - dot(p, p) * 0.22;

  c += uWonder * vec3(0.16, 0.05, 0.22) * (0.45 + 0.55 * sin(vUv.x * 7.0 + uTime * 0.04));
  c += uWonder * vec3(0.05, 0.12, 0.18) * (0.5 + 0.5 * sin(vUv.y * 5.0 - uTime * 0.03));

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
  private uniforms: {
    uMap: { value: THREE.DataTexture };
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
      desynchronized: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
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

    const uniforms = {
      uMap: { value: tex },
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
      this.uniforms.uTime.value += 1;
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
