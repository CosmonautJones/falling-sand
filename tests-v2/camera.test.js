import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { W, H } from '../public/v2/engine/world.js';
import {
  MAX_ZOOM,
  WORLD_W,
  WORLD_H,
  cameraFromView,
  clampView,
  containScale,
  defaultView,
  fillHeightScale,
  grainToScreen,
  panToCenter,
  panView,
  punchCamera,
  screenToGrain,
  shaderCamera,
  viewRect,
  zoomAround,
} from '../public/v2/camera.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');

// The desktop vessel is locked to the world aspect, and pan is the world origin
// in CSS pixels. That is the mapping index.html used before the camera.
function legacyGrain(vw, vh, view, sx, sy) {
  return {
    x: ((sx - view.panX) / (vw * view.zoom)) * WORLD_W,
    y: ((sy - view.panY) / (vh * view.zoom)) * WORLD_H,
  };
}
function legacyPan(vw, vh, zoom, panX, panY) {
  return {
    zoom,
    panX: Math.min(0, Math.max(vw - vw * zoom, panX)),
    panY: Math.min(0, Math.max(vh - vh * zoom, panY)),
  };
}

test('the camera agrees with the engine world size', () => {
  assert.equal(WORLD_W, 480);
  assert.equal(WORLD_H, 270);
  assert.equal(WORLD_W, W);
  assert.equal(WORLD_H, H);
});

test('a 16:9 desktop at zoom 1 is the whole world, and matches the old mapping', () => {
  const vw = 960, vh = 540;
  const view = defaultView(vw, vh);
  assert.deepEqual(view, { zoom: 1, panX: 0, panY: 0 });
  const cam = cameraFromView(vw, vh, view);
  assert.equal(cam.scale, 2);
  assert.equal(cam.x, 0);
  assert.equal(cam.y, 0);
  assert.deepEqual(screenToGrain(vw, vh, view, 0, 0), { x: 0, y: 0 });
  assert.deepEqual(screenToGrain(vw, vh, view, vw, vh), { x: 480, y: 270 });
  const mid = screenToGrain(vw, vh, view, vw / 2, vh / 2);
  assert.equal(mid.x, 240);
  assert.equal(mid.y, 135);
  const shader = shaderCamera(vw, vh, cam);
  assert.equal(shader.x, 0);
  assert.equal(shader.y, 0);
  assert.equal(shader.z, 1);
  assert.equal(shader.w, 1);
});

test('desktop zoom and pan match the pre-camera screen-to-grain math at every level', () => {
  const vw = 1280, vh = 720;
  const cases = [
    { zoom: 1, panX: 0, panY: 0, sx: 640, sy: 360 },
    { zoom: 2, panX: -200, panY: -80, sx: 100, sy: 40 },
    { zoom: 3.5, panX: -1280, panY: -400, sx: 1270, sy: 700 },
    { zoom: 12, panX: -5000, panY: -3000, sx: 10, sy: 10 },
    { zoom: 1.25, panX: -40.5, panY: -12.25, sx: 333.5, sy: 222.25 },
  ];
  for (const c of cases) {
    const view = legacyPan(vw, vh, c.zoom, c.panX, c.panY);
    assert.deepEqual(clampView(vw, vh, view), view);
    const got = screenToGrain(vw, vh, view, c.sx, c.sy);
    const old = legacyGrain(vw, vh, view, c.sx, c.sy);
    assert.ok(Math.abs(got.x - old.x) < 1e-9, `x ${got.x} vs ${old.x}`);
    assert.ok(Math.abs(got.y - old.y) < 1e-9, `y ${got.y} vs ${old.y}`);
    const zoomed = zoomAround(vw, vh, view, 1.7, c.sx, c.sy);
    const after = screenToGrain(vw, vh, zoomed, c.sx, c.sy);
    assert.ok(Math.abs(after.x - got.x) < 1e-6, 'zoom keeps the grain under the pointer');
    assert.ok(Math.abs(after.y - got.y) < 1e-6, 'zoom keeps the grain under the pointer');
    const centered = panToCenter(vw, vh, view, 100, 40);
    const legacyCenter = {
      zoom: view.zoom,
      panX: vw / 2 - 100 * (vw / WORLD_W) * view.zoom,
      panY: vh / 2 - 40 * (vh / WORLD_H) * view.zoom,
    };
    const clampedLegacy = legacyPan(vw, vh, legacyCenter.zoom, legacyCenter.panX, legacyCenter.panY);
    assert.ok(Math.abs(centered.panX - clampedLegacy.panX) < 1e-6);
    assert.ok(Math.abs(centered.panY - clampedLegacy.panY) < 1e-6);
    const rect = viewRect(vw, vh, view);
    assert.ok(Math.abs(rect.w - 1 / view.zoom) < 1e-9);
    assert.ok(Math.abs(rect.h - 1 / view.zoom) < 1e-9);
    assert.ok(Math.abs(rect.x - (-view.panX / (vw * view.zoom))) < 1e-9);
    assert.ok(Math.abs(rect.y - (-view.panY / (vh * view.zoom))) < 1e-9);
  }
});

test('a near-16:9 desktop still starts fitted, one pixel of rounding included', () => {
  const view = defaultView(1143, 643);
  assert.equal(view.zoom, 1);
  assert.equal(view.panX, 0);
  assert.equal(view.panY, 0);
});

test('a 390×844 phone fills the height: about 125 columns and about 3px per grain', () => {
  const vw = 390, vh = 844;
  const view = defaultView(vw, vh);
  const cam = cameraFromView(vw, vh, view);
  assert.ok(Math.abs(cam.scale - fillHeightScale(vh)) < 1e-9);
  assert.ok(Math.abs(cam.scale - 3) < 0.2, `px per grain ${cam.scale}`);
  assert.ok(Math.abs(cam.y) < 1e-6, 'the world top sits on the screen top');
  assert.ok(Math.abs(cam.y + WORLD_H * cam.scale - vh) < 1e-6, 'the world bottom sits on the screen bottom');
  const cols = vw / cam.scale;
  assert.ok(Math.abs(cols - 125) < 1, `visible columns ${cols}`);
  const mid = screenToGrain(vw, vh, view, vw / 2, vh / 2);
  assert.ok(Math.abs(mid.x - WORLD_W / 2) < 1e-6, 'the crop is centered on the world');
  assert.ok(Math.abs(mid.y - WORLD_H / 2) < 1e-6);
  const rect = viewRect(vw, vh, view);
  assert.ok(Math.abs(rect.h - 1) < 1e-9, 'the minimap shows the full height');
  assert.ok(Math.abs(rect.w - cols / WORLD_W) < 1e-9);
  assert.ok(rect.x > 0.2 && rect.x < 0.5, 'the window sits in the middle of the world');
  const shader = shaderCamera(vw, vh, cam);
  const pxX = (shader.z / WORLD_W) * vw;
  const pxY = (shader.w / WORLD_H) * vh;
  assert.ok(Math.abs(pxX - pxY) < 1e-9, 'the shader zoom is square in pixels');
  assert.ok(Math.abs(shader.w - 1) < 1e-9, 'height-fill maps world v to the full screen');
});

test('pointer mapping round-trips at every zoom and offset on a tall screen', () => {
  const vw = 390, vh = 844;
  let view = defaultView(vw, vh);
  const points = [
    [12, 8],
    [195, 422],
    [380, 830],
    [40.5, 100.25],
  ];
  const check = (label) => {
    for (const [sx, sy] of points) {
      const g = screenToGrain(vw, vh, view, sx, sy);
      const back = grainToScreen(vw, vh, view, g.x - 0.5, g.y - 0.5);
      assert.ok(Math.abs(back.x - sx) < 1e-6, `${label} x ${back.x} vs ${sx}`);
      assert.ok(Math.abs(back.y - sy) < 1e-6, `${label} y ${back.y} vs ${sy}`);
      assert.equal(Math.floor(g.x), Math.floor(screenToGrain(vw, vh, view, back.x, back.y).x));
    }
  };
  check('default');
  view = panView(vw, vh, view, -80, 0);
  check('panned');
  const focal = [140, 260];
  const before = screenToGrain(vw, vh, view, focal[0], focal[1]);
  view = zoomAround(vw, vh, view, 2.4, focal[0], focal[1]);
  const after = screenToGrain(vw, vh, view, focal[0], focal[1]);
  assert.ok(Math.abs(before.x - after.x) < 1e-6);
  assert.ok(Math.abs(before.y - after.y) < 1e-6);
  check('zoomed');
  view = zoomAround(vw, vh, view, 0.2, 200, 400);
  assert.ok(view.zoom < 2, 'zooming out from a close view moves toward the fitted world');
  check('zoomed out');
  const fitted = clampView(vw, vh, { zoom: 1, panX: 0, panY: 0 });
  assert.equal(fitted.zoom, 1);
  const fitCam = cameraFromView(vw, vh, fitted);
  assert.ok(Math.abs(fitCam.scale - containScale(vw, vh)) < 1e-9);
  assert.ok(Math.abs(fitCam.x) < 1e-6, 'fit on a phone uses the full width');
  assert.ok(fitCam.y > 0, 'fit on a phone letterboxes the short world inside the tall screen');
});

test('a bottom bar lifts the floor into view and still lets it pan back down', () => {
  const vw = 390, vh = 844, bar = 96;
  const plain = defaultView(vw, vh);
  const lifted = defaultView(vw, vh, bar);
  const a = cameraFromView(vw, vh, plain);
  const b = cameraFromView(vw, vh, lifted);
  assert.ok(Math.abs(a.scale - b.scale) < 1e-9, 'grain size stays the fill-height size');
  assert.ok(Math.abs(b.y - (a.y - bar)) < 1e-6, 'the world rises by the bar');
  assert.ok(Math.abs(b.y + WORLD_H * b.scale - (vh - bar)) < 1e-6, 'the floor sits on top of the bar');
  const floor = screenToGrain(vw, vh, lifted, vw / 2, vh - bar - 1, bar);
  assert.ok(floor.y > WORLD_H - 2 && floor.y < WORLD_H, `floor grain ${floor.y}`);
  const back = panView(vw, vh, lifted, 0, bar, bar);
  assert.ok(Math.abs(cameraFromView(vw, vh, back).y) < 1e-6, 'panning down brings the top of the world back');
  const tooFar = panView(vw, vh, lifted, 0, -400, bar);
  assert.ok(Math.abs(cameraFromView(vw, vh, tooFar).y - b.y) < 1e-6, 'the floor cannot rise past the bar');
  assert.deepEqual(defaultView(vw, vh, 0), plain);
  assert.deepEqual(defaultView(1280, 720), { zoom: 1, panX: 0, panY: 0 });
});

test('a left rail shifts the world so its left edge clears the buttons', () => {
  const vw = 844, vh = 390, rail = 123;
  const plain = defaultView(vw, vh);
  const shifted = defaultView(vw, vh, { left: rail });
  const cam = cameraFromView(vw, vh, shifted);
  assert.equal(shifted.zoom, 1, 'the landscape default is still the whole vessel');
  assert.ok(cam.x >= rail - 0.01, `left edge ${cam.x} is not under the rail`);
  assert.ok(cam.x + WORLD_W * cam.scale <= vw + 0.01, 'the right edge stays on screen');
  const edge = screenToGrain(vw, vh, shifted, cam.x + 1, vh / 2, { left: rail });
  assert.ok(edge.x >= 0 && edge.x < 1, `the left edge grain is reachable (${edge.x})`);
  const wall = grainToScreen(vw, vh, shifted, 0, WORLD_H / 2, { left: rail });
  assert.ok(wall.x > rail, 'the wall sits to the right of the rail');
  const panned = panView(vw, vh, shifted, -80, 0, { left: rail });
  assert.ok(Math.abs(cameraFromView(vw, vh, panned).x - cam.x) < 1e-6, 'a world that fits beside the rail stays fully visible');
  assert.deepEqual(plain, { zoom: 1, panX: 0, panY: 0 });
  const wide = 200;
  const pinned = cameraFromView(vw, vh, defaultView(vw, vh, { left: wide }));
  assert.ok(Math.abs(pinned.x - wide) < 1e-6, 'when the world no longer fits, the default still shows the left edge');
  const revealed = panView(vw, vh, defaultView(vw, vh, { left: wide }), -400, 0, { left: wide });
  const right = cameraFromView(vw, vh, revealed);
  assert.ok(Math.abs(right.x + WORLD_W * right.scale - vw) < 1e-4, 'panning reaches the right edge');
  assert.ok(right.x < wide, 'reaching the right edge may slide the left under the rail');
  const past = panView(vw, vh, defaultView(vw, vh, { left: wide }), 400, 0, { left: wide });
  assert.ok(Math.abs(cameraFromView(vw, vh, past).x - wide) < 1e-6, 'the left edge cannot move past the rail');
});

test('a landscape phone that is wider than the world shows the whole vessel', () => {
  const view = defaultView(844, 390);
  assert.deepEqual(view, { zoom: 1, panX: 0, panY: 0 });
  const cam = cameraFromView(844, 390, view);
  assert.ok(cam.x > 0, 'side bars, not a crop');
  assert.ok(Math.abs(cam.y) < 1e-6);
  assert.equal(viewRect(844, 390, view).w, 1);
  assert.equal(viewRect(844, 390, view).h, 1);
});

test('the blast punch stays stuck to the grain it leans toward', () => {
  const cam = cameraFromView(960, 540, { zoom: 2, panX: -100, panY: -40 });
  const ax = 0.3, ay = 0.7;
  const before = { x: cam.x + ax * WORLD_W * cam.scale, y: cam.y + ay * WORLD_H * cam.scale };
  const punched = punchCamera(cam, 1.05, ax, ay);
  const after = { x: punched.x + ax * WORLD_W * punched.scale, y: punched.y + ay * WORLD_H * punched.scale };
  assert.ok(Math.abs(before.x - after.x) < 1e-6);
  assert.ok(Math.abs(before.y - after.y) < 1e-6);
  assert.equal(punchCamera(cam, 1, ax, ay), cam);
});

test('4× of a 390×844 fill fits the zoom cap, and 5× does not', () => {
  const fill = defaultView(390, 844);
  assert.ok(fill.zoom * 2 <= MAX_ZOOM);
  assert.ok(fill.zoom * 4 <= MAX_ZOOM, `4× fill ${fill.zoom * 4} should fit under ${MAX_ZOOM}`);
  assert.ok(fill.zoom * 5 > MAX_ZOOM);
});

test('a right inset keeps the landscape wall out of the safe area', () => {
  const vw = 844, vh = 390, rail = 76, notch = 47;
  const view = defaultView(vw, vh, { left: rail, right: notch });
  const cam = cameraFromView(vw, vh, view);
  assert.ok(cam.x >= rail - 0.01, `left edge ${cam.x} is under the rail`);
  assert.ok(cam.x + WORLD_W * cam.scale <= vw - notch + 0.01, 'the right wall clears the notch');
  const tight = defaultView(vw, vh, { left: 200, right: notch });
  const pinned = cameraFromView(vw, vh, tight);
  assert.ok(Math.abs(pinned.x - 200) < 1e-6, 'a rail the world cannot clear still wins the default');
  const pulled = panView(vw, vh, tight, -400, 0, { left: 200, right: notch });
  const cleared = cameraFromView(vw, vh, pulled);
  assert.ok(Math.abs(cleared.x + WORLD_W * cleared.scale - (vw - notch)) < 1e-3, 'panning still reaches the right safe edge');
});

test('the page renders through the camera, not a single uZoom', () => {
  assert.match(html, /uniform vec4 uCamera;/);
  assert.equal(html.includes('uniform float uZoom'), false);
  assert.equal(html.includes('uniform vec2 uPan'), false);
  assert.match(html, /screenToGrain\(/);
  assert.match(html, /defaultView\(/);
  assert.match(html, /from '\.\/camera\.js'|camera\.js/);
});
