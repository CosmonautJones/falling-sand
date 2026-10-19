const WGSL = `
struct Uniforms {
  grid: vec2f,
  time: f32,
  glow: f32,
  wonder: f32,
  shake: f32,
  viewOrigin: vec2f,
  viewSize: vec2f,
  _pad: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var grain: texture_2d<f32>;
@group(0) @binding(2) var grainSampler: sampler;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vertex(@builtin(vertex_index) index: u32) -> VertexOut {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: VertexOut;
  out.position = vec4f(positions[index], 0.0, 1.0);
  out.uv = positions[index] * vec2f(0.5, -0.5) + vec2f(0.5);
  return out;
}

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

@fragment
fn fragment(input: VertexOut) -> @location(0) vec4f {
  let mapped = (input.uv - uniforms.viewOrigin) / uniforms.viewSize;
  let inside = mapped.x >= 0.0 && mapped.x <= 1.0 && mapped.y >= 0.0 && mapped.y <= 1.0;
  let sampleUv = clamp(mapped, vec2f(0.0), vec2f(1.0));
  let probe = textureSample(grain, grainSampler, sampleUv);
  let heat = max(probe.r - probe.b * 0.88 - 0.16, 0.0);
  let wet = max(probe.b - probe.r * 0.65 - 0.12, 0.0);
  var uv = sampleUv;
  uv.x += sin(sampleUv.y * 28.0 + uniforms.time * 0.05) * heat * 0.0012 * uniforms.glow;
  uv.y += cos(sampleUv.x * 22.0 + uniforms.time * 0.04) * heat * 0.0007 * uniforms.glow;
  if (uniforms.shake > 0.001) {
    uv += (vec2f(hash(vec2f(uniforms.time, 2.1)), hash(vec2f(uniforms.time, 7.7))) - 0.5) * uniforms.shake * 0.014;
  }
  var color = textureSample(grain, grainSampler, uv).rgb;
  color += vec3f(0.45, 0.12, 0.03) * heat * 0.12 * uniforms.glow;
  let caustic = sin(uv.x * 5.0 + uniforms.time * 0.02) * sin(uv.y * 3.5 - uniforms.time * 0.015);
  color += wet * caustic * uniforms.glow * vec3f(0.012, 0.024, 0.04);
  let gold = max(color.r - 0.72, 0.0) * max(color.g - 0.52, 0.0) * max(0.28 - color.b, 0.0);
  let spark = step(0.97, hash(floor(uv * uniforms.grid) + floor(uniforms.time * 0.08)));
  color += gold * spark * 0.35 * uniforms.glow * vec3f(1.0, 0.85, 0.35);
  let aether = max(color.b - 0.55, 0.0) * max(color.g - 0.4, 0.0);
  color += aether * 0.12 * uniforms.glow * vec3f(0.2, 0.55, 1.0);
  let p = input.uv * 2.0 - 1.0;
  color *= 1.0 - dot(vec2f(p.x * 1.06, p.y), vec2f(p.x * 1.06, p.y)) * 0.22;
  color += uniforms.wonder * vec3f(0.16, 0.05, 0.22) * (0.45 + 0.55 * sin(input.uv.x * 7.0 + uniforms.time * 0.04));
  color += uniforms.wonder * vec3f(0.05, 0.12, 0.18) * (0.5 + 0.5 * sin(input.uv.y * 5.0 - uniforms.time * 0.03));
  if (uniforms.shake > 0.001) {
    color += vec3f(1.0, 0.62, 0.28) * uniforms.shake * 0.09;
  }
  if (!inside) { return vec4f(0.09, 0.149, 0.122, 1.0); }
  return vec4f(color, 1.0);
}
`;

type GpuTexture = { createView(): unknown };
type GpuBuffer = { destroy(): void };
type GpuQueue = {
  writeBuffer(buffer: GpuBuffer, offset: number, data: ArrayBufferView): void;
  writeTexture(
    destination: { texture: GpuTexture },
    data: Uint8Array,
    layout: { bytesPerRow: number; rowsPerImage: number },
    size: { width: number; height: number; depthOrArrayLayers: number },
  ): void;
  submit(commands: unknown[]): void;
};
type GpuDevice = {
  queue: GpuQueue;
  lost: Promise<{ message: string }>;
  addEventListener?: (
    type: 'uncapturederror',
    listener: (event: { error?: { message?: string } }) => void,
  ) => void;
  createShaderModule(desc: { code: string }): unknown;
  createRenderPipeline(desc: unknown): {
    getBindGroupLayout(index: number): unknown;
    createBindGroup(desc: unknown): unknown;
  };
  createBuffer(desc: { size: number; usage: number }): GpuBuffer;
  createTexture(desc: {
    size: { width: number; height: number; depthOrArrayLayers?: number };
    format: string;
    usage: number;
  }): GpuTexture;
  createSampler(desc: {
    magFilter: string;
    minFilter: string;
    addressModeU: string;
    addressModeV: string;
  }): unknown;
  createBindGroup(desc: { layout: unknown; entries: unknown[] }): unknown;
  createCommandEncoder(): {
    beginRenderPass(desc: unknown): {
      setPipeline(pipeline: unknown): void;
      setBindGroup(index: number, group: unknown): void;
      draw(vertexCount: number): void;
      end(): void;
    };
    finish(): unknown;
  };
};
type GpuContext = {
  configure(desc: { device: GpuDevice; format: string; alphaMode: string }): void;
  getCurrentTexture(): GpuTexture;
};
type GpuAdapter = { requestDevice(): Promise<GpuDevice> };
type Gpu = { requestAdapter(): Promise<GpuAdapter | null>; getPreferredCanvasFormat(): string };

type GpuNavigator = Navigator & { gpu?: Gpu };

const TEXTURE_COPY_DST = 0x02;
const TEXTURE_BINDING = 0x04;
const BUFFER_COPY_DST = 0x08;
const BUFFER_UNIFORM = 0x40;

type GpuCanvas = HTMLCanvasElement & {
  convertToBlob?: (options?: { type?: string }) => Promise<Blob>;
};

export interface WebGpuPresenterOptions {
  onReady?: () => void;
  onLost?: () => void;
}

/**
 * Small presentation-only WebGPU path. The simulation still owns the source
 * canvas and supplies a CPU RGBA frame; this class only shades and presents it.
 */
export class WebGpuPresenter {
  private readonly source: HTMLCanvasElement;
  private readonly width: number;
  private readonly height: number;
  private readonly options: WebGpuPresenterOptions;
  private readonly canvas: GpuCanvas;
  private readonly rowPitch: number;
  private readonly upload: Uint8Array;
  private readonly uniformsData = new Float32Array(12);
  private cssWidth = 1;
  private cssHeight = 1;
  private viewRect: { x: number; y: number; width: number; height: number } | null = null;
  private context: GpuContext | null = null;
  private device: GpuDevice | null = null;
  private texture: GpuTexture | null = null;
  private uniformBuffer: GpuBuffer | null = null;
  private bindGroup: unknown = null;
  private pipeline: unknown = null;
  private ready = false;
  private lost = false;
  private gpuError = false;

  constructor(
    source: HTMLCanvasElement,
    width: number,
    height: number,
    options: WebGpuPresenterOptions = {},
  ) {
    this.source = source;
    this.width = width;
    this.height = height;
    this.options = options;
    this.rowPitch = Math.ceil((width * 4) / 256) * 256;
    this.upload = new Uint8Array(this.rowPitch * height);
    const canvas = source.ownerDocument.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;visibility:hidden;pointer-events:none;z-index:auto;';
    canvas.style.imageRendering = source.style.imageRendering;
    canvas.style.transformOrigin = source.style.transformOrigin || '0 0';
    source.parentElement?.insertBefore(canvas, source.nextSibling);
    this.canvas = canvas as GpuCanvas;
    this.resize(source.width || width, source.height || height);
  }

  get active(): boolean {
    return this.ready && !this.lost;
  }

  start(): void {
    const gpu = (globalThis.navigator as GpuNavigator | undefined)?.gpu;
    if (!gpu) return;
    void this.initialize(gpu);
  }

  resize(pixelWidth: number, pixelHeight: number): void {
    this.canvas.width = Math.max(1, pixelWidth);
    this.canvas.height = Math.max(1, pixelHeight);
    const rect = this.source.getBoundingClientRect();
    this.cssWidth = rect.width || pixelWidth;
    this.cssHeight = rect.height || pixelHeight;
    this.syncTransform();
  }

  setView(rect: { x: number; y: number; width: number; height: number } | null): void {
    this.viewRect = rect;
    this.syncTransform();
  }

  present(
    pixels: Uint8ClampedArray,
    time: number,
    glow: number,
    wonder: number,
    shake: number,
  ): void {
    if (
      !this.active ||
      !this.device ||
      !this.context ||
      !this.texture ||
      !this.uniformBuffer ||
      !this.bindGroup ||
      !this.pipeline
    )
      return;
    for (let y = 0; y < this.height; y++) {
      this.upload.set(
        pixels.subarray(y * this.width * 4, (y + 1) * this.width * 4),
        y * this.rowPitch,
      );
    }
    const view = this.viewRect;
    const originX = view ? view.x / this.cssWidth : 0;
    const originY = view ? view.y / this.cssHeight : 0;
    const sizeX = view ? view.width / this.cssWidth : 1;
    const sizeY = view ? view.height / this.cssHeight : 1;
    this.uniformsData.set([
      this.width,
      this.height,
      time,
      glow,
      wonder,
      shake,
      originX,
      originY,
      sizeX,
      sizeY,
      0,
      0,
    ]);
    this.device.queue.writeTexture(
      { texture: this.texture },
      this.upload,
      { bytesPerRow: this.rowPitch, rowsPerImage: this.height },
      { width: this.width, height: this.height, depthOrArrayLayers: 1 },
    );
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformsData);
    this.syncTransform();
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.055, g: 0.047, b: 0.07, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  async toBlob(type = 'image/png'): Promise<Blob | null> {
    if (!this.active) return null;
    if (this.canvas.convertToBlob) return this.canvas.convertToBlob({ type });
    return new Promise((resolve) => this.canvas.toBlob(resolve, type));
  }

  captureStream(frameRate?: number): MediaStream | null {
    return this.active && this.canvas.captureStream ? this.canvas.captureStream(frameRate) : null;
  }

  private syncTransform(): void {
    this.canvas.style.transform = this.viewRect ? 'none' : this.source.style.transform;
  }

  private async initialize(gpu: Gpu): Promise<void> {
    try {
      const adapter = await gpu.requestAdapter();
      if (!adapter) return;
      const device = await adapter.requestDevice();
      device.addEventListener?.('uncapturederror', () => {
        if (!this.ready) this.gpuError = true;
        else this.disableGpu();
      });
      const context = this.canvas.getContext('webgpu') as unknown as GpuContext | null;
      if (!context) return;
      const format = gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'opaque' });
      const module = device.createShaderModule({ code: WGSL });
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vertex' },
        fragment: { module, entryPoint: 'fragment', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
      const textureUsage = (
        globalThis as typeof globalThis & {
          GPUTextureUsage?: { COPY_DST: number; TEXTURE_BINDING: number };
        }
      ).GPUTextureUsage;
      const texture = device.createTexture({
        size: { width: this.width, height: this.height, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage:
          (textureUsage?.COPY_DST ?? TEXTURE_COPY_DST) |
          (textureUsage?.TEXTURE_BINDING ?? TEXTURE_BINDING),
      });
      const uniformBuffer = device.createBuffer({
        size: this.uniformsData.byteLength,
        usage: BUFFER_COPY_DST | BUFFER_UNIFORM,
      });
      const sampler = device.createSampler({
        magFilter: 'nearest',
        minFilter: 'nearest',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
      const bindGroup = device.createBindGroup({
        layout: (pipeline as { getBindGroupLayout(index: number): unknown }).getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: texture.createView() },
          { binding: 2, resource: sampler },
        ],
      });
      if (this.gpuError) return;
      this.device = device;
      this.context = context;
      this.texture = texture;
      this.uniformBuffer = uniformBuffer;
      this.pipeline = pipeline;
      this.bindGroup = bindGroup;
      this.ready = true;
      this.canvas.style.visibility = 'visible';
      device.lost
        .then(() => {
          this.disableGpu();
        })
        .catch(() => undefined);
      this.options.onReady?.();
    } catch {
      // A rejected adapter/device/shader must leave the established fallback intact.
    }
  }

  private disableGpu(): void {
    if (!this.ready) return;
    this.ready = false;
    this.lost = true;
    this.canvas.style.visibility = 'hidden';
    this.options.onLost?.();
  }
}
