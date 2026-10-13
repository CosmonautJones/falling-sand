# WebGPU verification — 2026-10-13

Reference: falling-sand commit d341ba9cbb0228d255812fea4765ce5149c46d22.
Runtime: Windows 11, RTX 3090; Chrome155, WebGPU adapter vendor nvidia, architecture ampere, non-fallback adapter.

## Automated checks

- Classic Vitest:168 passed.
- V2:180 passed.
- V3:37 passed.
- WebGPU lifecycle/upload/capture/camera tests:2 passed.
- TypeScript, ESLint, production build and diff whitespace:passed.
- Build retains the existing large-bundle warning (560.14kB minified).

## Browser checks

All three routes initialized real WebGPU (V2 explicitly with renderer=webgpu).
Destroying the serving GPU device restored the legacy canvas on each route.
Five injected startup failures each restored fallback on every route: missing API,
null adapter, rejected adapter, rejected device, and invalid WGSL shader.

V3 was checked at1280×800 and390×844. GPU camera bounds match Canvas2D;
HUD, pause/gate controls and brush cursor remain visible. Painting changes the
checkpoint; Load restores it byte-for-byte; viewport rotation preserves it.
A real Chrome touch-input sequence pinched/panned the camera while leaving a
2.1MB checkpoint byte-identical. This is desktop mobile emulation, not a phone test.

V2 opt-in preview exported a PNG decoded by the browser at1001×563 (86175bytes)
and a VP9 WebM at1001×563 (550361bytes). Independent FFmpeg full decode passed;
FFprobe measured5.960537seconds. These were local synthetic game captures.

V2 keeps its complete WebGL lighting/particles by default; WebGPU currently has
simpler effects. Simulation, saves and material rules are unchanged.

Screenshots/capture files and command logs are kept locally under ignored
qa-shots/. No browser deployment, router/firewall change or GPU-driver install
was performed. Serving on HTTPS is necessary for WebGPU outside localhost.
