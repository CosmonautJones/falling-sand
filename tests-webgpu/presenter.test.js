import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const read = file => readFileSync(resolve(root, file), 'utf8');

function browserHarness(source) {
  const writes = { texture: 0, buffer: 0, submits: 0 };
  let usageSeen = 0;
  let uniformsSeen = [];
  let lose;
  const device = {
    queue: {
      writeTexture() { writes.texture++; },
      writeBuffer(_buffer, _offset, data) { writes.buffer++; uniformsSeen = [...data]; },
      submit() { writes.submits++; },
    },
    lost: new Promise(resolveLost => { lose = resolveLost; }),
    addEventListener() {},
    createShaderModule() { return {}; },
    createRenderPipeline() { return { getBindGroupLayout() { return {}; } }; },
    createBuffer() { return {}; },
    createTexture(desc) {
      usageSeen = desc.usage;
      return { createView() { return {}; } };
    },
    createSampler() { return {}; },
    createBindGroup() { return {}; },
    createCommandEncoder() {
      return {
        beginRenderPass() { return { setPipeline() {}, setBindGroup() {}, draw() {}, end() {} }; },
        finish() { return {}; },
      };
    },
  };
  const context = { configure() {}, getCurrentTexture() { return { createView() { return {}; } }; } };
  const makeCanvas = () => ({
    width: 0,
    height: 0,
    style: {},
    setAttribute() {},
    getContext(kind) { return kind === 'webgpu' ? context : null; },
    toBlob(callback, type) { callback({ type }); },
    captureStream() { return {}; },
  });
  const parent = { insertBefore(child) { this.child = child; } };
  const sourceCanvas = {
    ownerDocument: { createElement: makeCanvas },
    parentElement: parent,
    width: 4,
    height: 2,
    style: {},
    getBoundingClientRect() { return { width: 80, height: 40 }; },
  };
  const gpu = {
    async requestAdapter() { return { async requestDevice() { return device; } }; },
    getPreferredCanvasFormat() { return 'bgra8unorm'; },
  };
  const sandbox = vm.createContext({
    GPUTextureUsage: { COPY_DST: 2, TEXTURE_BINDING: 4 },
    navigator: { gpu },
    console,
  });
  vm.runInContext(source, sandbox);
  return { device, lose, usageSeen: () => usageSeen, uniformsSeen: () => uniformsSeen, writes, sourceCanvas, sandbox };
}

test('presenter uploads a frame with named usage bits, captures through toBlob, maps the camera, and falls back on device loss', async () => {
  const harness = browserHarness(read('public/webgpu-presenter.js'));
  let lost = 0;
  const presenter = new harness.sandbox.WebGpuPresenter(harness.sourceCanvas, 4, 2, { onLost: () => { lost++; } });
  presenter.start();
  await new Promise(resolveReady => setImmediate(resolveReady));
  assert.equal(presenter.active, true);
  assert.equal(harness.usageSeen(), 6);
  presenter.setView({ x: 8, y: 4, width: 40, height: 20 });
  presenter.present(new Uint8ClampedArray(4 * 2 * 4), 1, 1, 0, 0);
  assert.deepEqual(harness.writes, { texture: 1, buffer: 1, submits: 1 });
  assert.ok(Math.abs(harness.uniformsSeen()[6] - 0.1) < 1e-6);
  assert.ok(Math.abs(harness.uniformsSeen()[7] - 0.1) < 1e-6);
  assert.ok(Math.abs(harness.uniformsSeen()[8] - 0.5) < 1e-6);
  assert.ok(Math.abs(harness.uniformsSeen()[9] - 0.5) < 1e-6);
  assert.deepEqual(await presenter.toBlob('image/png'), { type: 'image/png' });
  harness.lose({ message: 'test loss' });
  await new Promise(resolveLost => setImmediate(resolveLost));
  assert.equal(presenter.active, false);
  assert.equal(lost, 1);
});

test('missing, rejected, or unavailable adapters leave the presenter inactive', async () => {
  const source = read('public/webgpu-presenter.js');
  const noApiSandbox = vm.createContext({ navigator: {}, console });
  vm.runInContext(source, noApiSandbox);
  const noApiCanvas = browserHarness(source).sourceCanvas;
  const noApi = new noApiSandbox.WebGpuPresenter(noApiCanvas, 4, 2);
  noApi.start();
  assert.equal(noApi.active, false);

  const rejectedSandbox = vm.createContext({
    navigator: { gpu: { async requestAdapter() { return null; } } },
    console,
  });
  vm.runInContext(source, rejectedSandbox);
  const rejected = new rejectedSandbox.WebGpuPresenter(browserHarness(source).sourceCanvas, 4, 2);
  rejected.start();
  await new Promise(resolveReady => setImmediate(resolveReady));
  assert.equal(rejected.active, false);

  const deviceSandbox = vm.createContext({
    navigator: { gpu: { async requestAdapter() { return { async requestDevice() { throw new Error('device rejected'); } }; } } },
    console,
  });
  vm.runInContext(source, deviceSandbox);
  const deviceRejected = new deviceSandbox.WebGpuPresenter(browserHarness(source).sourceCanvas, 4, 2);
  deviceRejected.start();
  await new Promise(resolveReady => setImmediate(resolveReady));
  assert.equal(deviceRejected.active, false);
});