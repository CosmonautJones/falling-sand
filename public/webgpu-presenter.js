/* Optional presentation-only WebGPU path shared by Alembic v2 and v3. */
(function () {
  const WGSL = `
struct Uniforms { grid: vec2f, time: f32, glow: f32, wonder: f32, shake: f32, viewOrigin: vec2f, viewSize: vec2f, _pad: vec2f };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var grain: texture_2d<f32>;
@group(0) @binding(2) var grainSampler: sampler;
struct VertexOut { @builtin(position) position: vec4f, @location(0) uv: vec2f };
@vertex fn vertex(@builtin(vertex_index) index: u32) -> VertexOut {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: VertexOut; out.position = vec4f(positions[index], 0.0, 1.0); out.uv = positions[index] * vec2f(0.5, -0.5) + vec2f(0.5); return out;
}
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }
@fragment fn fragment(input: VertexOut) -> @location(0) vec4f {
  let mapped = (input.uv - uniforms.viewOrigin) / uniforms.viewSize;
  let inside = mapped.x >= 0.0 && mapped.x <= 1.0 && mapped.y >= 0.0 && mapped.y <= 1.0;
  let sampleUv = clamp(mapped, vec2f(0.0), vec2f(1.0));
  let probe = textureSample(grain, grainSampler, sampleUv);
  let heat = max(probe.r - probe.b * 0.88 - 0.16, 0.0);
  let wet = max(probe.b - probe.r * 0.65 - 0.12, 0.0);
  var uv = sampleUv;
  uv.x += sin(sampleUv.y * 28.0 + uniforms.time * 0.05) * heat * 0.0012 * uniforms.glow;
  uv.y += cos(sampleUv.x * 22.0 + uniforms.time * 0.04) * heat * 0.0007 * uniforms.glow;
  if (uniforms.shake > 0.001) { uv += (vec2f(hash(vec2f(uniforms.time, 2.1)), hash(vec2f(uniforms.time, 7.7))) - 0.5) * uniforms.shake * 0.014; }
  var color = textureSample(grain, grainSampler, uv).rgb;
  color += vec3f(0.45, 0.12, 0.03) * heat * 0.12 * uniforms.glow;
  let caustic = sin(uv.x * 5.0 + uniforms.time * 0.02) * sin(uv.y * 3.5 - uniforms.time * 0.015);
  color += wet * caustic * uniforms.glow * vec3f(0.012, 0.024, 0.04);
  let gold = max(color.r - 0.72, 0.0) * max(color.g - 0.52, 0.0) * max(0.28 - color.b, 0.0);
  let spark = step(0.97, hash(floor(uv * uniforms.grid) + floor(uniforms.time * 0.08)));
  color += gold * spark * 0.35 * uniforms.glow * vec3f(1.0, 0.85, 0.35);
  let aether = max(color.b - 0.55, 0.0) * max(color.g - 0.4, 0.0);
  color += aether * 0.12 * uniforms.glow * vec3f(0.2, 0.55, 1.0);
  let p = input.uv * 2.0 - 1.0; color *= 1.0 - dot(vec2f(p.x * 1.06, p.y), vec2f(p.x * 1.06, p.y)) * 0.22;
  color += uniforms.wonder * vec3f(0.16, 0.05, 0.22) * (0.45 + 0.55 * sin(input.uv.x * 7.0 + uniforms.time * 0.04));
  color += uniforms.wonder * vec3f(0.05, 0.12, 0.18) * (0.5 + 0.5 * sin(input.uv.y * 5.0 - uniforms.time * 0.03));
  if (uniforms.shake > 0.001) { color += vec3f(1.0, 0.62, 0.28) * uniforms.shake * 0.09; }
  if (!inside) { return vec4f(0.09, 0.149, 0.122, 1.0); }
  return vec4f(color, 1.0);
}`;
  const TEXTURE_COPY_DST = 0x02, TEXTURE_BINDING = 0x04, BUFFER_COPY_DST = 0x08, BUFFER_UNIFORM = 0x40;

  class WebGpuPresenter {
    constructor(source, width, height, options = {}) {
      this.source = source; this.width = width; this.height = height; this.options = options;
      this.rowPitch = Math.ceil((width * 4) / 256) * 256; this.upload = new Uint8Array(this.rowPitch * height);
      this.uniforms = new Float32Array(12); this.ready = false; this.lost = false; this.gpuError = false;
      this.cssWidth = 1; this.cssHeight = 1; this.viewRect = null;
      this.canvas = source.ownerDocument.createElement('canvas');
      this.canvas.setAttribute('aria-hidden', 'true');
      this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;visibility:hidden;pointer-events:none;z-index:auto;';
      this.canvas.style.imageRendering = source.style.imageRendering;
      this.canvas.style.transformOrigin = source.style.transformOrigin || '0 0';
      source.parentElement?.insertBefore(this.canvas, source.nextSibling); this.resize(source.width || width, source.height || height);
    }
    get active() { return this.ready && !this.lost; }
    start() { const gpu = globalThis.navigator?.gpu; if (gpu) void this.initialize(gpu); }
    resize(w, h) { this.canvas.width = Math.max(1, w); this.canvas.height = Math.max(1, h); const rect = this.source.getBoundingClientRect(); this.cssWidth = rect.width || w; this.cssHeight = rect.height || h; this.syncTransform(); }
    setView(rect) { this.viewRect = rect; this.syncTransform(); }
    present(pixels, time, glow = 1, wonder = 0, shake = 0) {
      if (!this.active || !this.device) return;
      for (let y = 0; y < this.height; y++) this.upload.set(pixels.subarray(y * this.width * 4, (y + 1) * this.width * 4), y * this.rowPitch);
      const v = this.viewRect, ox = v ? v.x / this.cssWidth : 0, oy = v ? v.y / this.cssHeight : 0, sx = v ? v.width / this.cssWidth : 1, sy = v ? v.height / this.cssHeight : 1;
      this.uniforms.set([this.width, this.height, time, glow, wonder, shake, ox, oy, sx, sy, 0, 0]);
      this.device.queue.writeTexture({ texture: this.texture }, this.upload, { bytesPerRow: this.rowPitch, rowsPerImage: this.height }, { width: this.width, height: this.height, depthOrArrayLayers: 1 });
      this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniforms); this.syncTransform();
      const encoder = this.device.createCommandEncoder(), pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), clearValue: { r: .055, g: .047, b: .07, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(this.pipeline); pass.setBindGroup(0, this.bindGroup); pass.draw(3); pass.end(); this.device.queue.submit([encoder.finish()]);
    }
    async toBlob(type = 'image/png') { if (!this.active) return null; if (this.canvas.convertToBlob) return this.canvas.convertToBlob({ type }); return new Promise(resolve => this.canvas.toBlob(resolve, type)); }
    captureStream(rate) { return this.active && this.canvas.captureStream ? this.canvas.captureStream(rate) : null; }
    syncTransform() { this.canvas.style.transform = this.viewRect ? 'none' : this.source.style.transform; }
    async initialize(gpu) {
      try {
        const adapter = await gpu.requestAdapter(); if (!adapter) return;
        const device = await adapter.requestDevice();
        device.addEventListener?.('uncapturederror', () => { if (!this.ready) this.gpuError = true; else this.disableGpu(); });
        const context = this.canvas.getContext('webgpu'); if (!context) return;
        const format = gpu.getPreferredCanvasFormat(); context.configure({ device, format, alphaMode: 'opaque' });
        const module = device.createShaderModule({ code: WGSL });
        const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module, entryPoint: 'vertex' }, fragment: { module, entryPoint: 'fragment', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
        const textureUsage = globalThis.GPUTextureUsage || {};
        const texture = device.createTexture({ size: { width: this.width, height: this.height, depthOrArrayLayers: 1 }, format: 'rgba8unorm', usage: (textureUsage.COPY_DST ?? TEXTURE_COPY_DST) | (textureUsage.TEXTURE_BINDING ?? TEXTURE_BINDING) });
        const uniformBuffer = device.createBuffer({ size: this.uniforms.byteLength, usage: BUFFER_COPY_DST | BUFFER_UNIFORM });
        const sampler = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
        const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniformBuffer } }, { binding: 1, resource: texture.createView() }, { binding: 2, resource: sampler }] });
        if (this.gpuError) return;
        this.device = device; this.context = context; this.texture = texture; this.uniformBuffer = uniformBuffer; this.pipeline = pipeline; this.bindGroup = bindGroup; this.ready = true; this.canvas.style.visibility = 'visible';
        device.lost.then(() => this.disableGpu()).catch(() => {});
        this.options.onReady?.();
      } catch (_) { /* Keep the established WebGL/2D renderer. */ }
    }
    disableGpu() { if (!this.ready) return; this.ready = false; this.lost = true; this.canvas.style.visibility = 'hidden'; this.options.onLost?.(); }
  }
  globalThis.WebGpuPresenter = WebGpuPresenter;
})();
