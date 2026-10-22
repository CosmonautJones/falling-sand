import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as cam from '../public/v2/camera.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const method = name => { const i = html.indexOf(`  ${name}(`); return html.slice(i, html.indexOf('\n  }\n', i)); };

function phone() {
  const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  const context = {
    DCLogic: class { constructor() { this.props = {}; } },
    React: { createRef: () => ({ current: null }) },
    performance: { now: () => 0 },
    localStorage: { getItem: () => null },
    requestAnimationFrame: () => 1,
    clearTimeout() {},
    Float32Array, Uint32Array, Uint8Array,
    window: {},
  };
  vm.createContext(context);
  vm.runInContext(script + '\nthis.Component = Component;', context);
  const ui = new context.Component();
  ui.cam = cam;
  ui.M = { W: cam.WORLD_W, H: cam.WORLD_H };
  ui.viewRaf = 0;
  return ui;
}

function at(ui, vw, vh) {
  ui.vw = vw;
  ui.vh = vh;
  const fill = cam.defaultView(vw, vh);
  ui.view = { ...fill };
  ui.viewT = ui.view;
  ui.zoomAnchor = null;
  return fill;
}

test('the phone zoom cycles 1×, 2×, 4×, and the whole vessel when 4× fits the cap', () => {
  const ui = phone();
  const fill = at(ui, 390, 844);
  assert.ok(fill.zoom * 4 <= cam.MAX_ZOOM + 1e-3, 'a 390×844 fill doubled twice still fits');
  assert.equal(ui.zoomLabel(ui.viewT.zoom), '1×');

  ui.cycleZoom();
  assert.ok(Math.abs(ui.viewT.zoom / fill.zoom - 2) < 0.05, 'the first press doubles the fill');
  assert.equal(ui.zoomAnchor.sx, 195, 'the double is around the middle of the view');
  assert.equal(ui.zoomAnchor.sy, 422);
  assert.equal(ui.zoomLabel(ui.viewT.zoom), '2×');

  ui.cycleZoom();
  assert.ok(Math.abs(ui.viewT.zoom / fill.zoom - 4) < 0.05, 'the second press reaches 4×');
  assert.ok(ui.viewT.zoom <= cam.MAX_ZOOM + 1e-3);
  assert.equal(ui.zoomLabel(ui.viewT.zoom), '4×');

  ui.cycleZoom();
  assert.ok(ui.viewT.zoom < 1.05, 'the next press is the whole vessel');
  assert.equal(ui.zoomLabel(ui.viewT.zoom), '⊕');

  ui.cycleZoom();
  assert.ok(Math.abs(ui.viewT.zoom - fill.zoom) < 0.05, 'the press after ⊕ restores the 1× fill');
  assert.equal(ui.zoomLabel(ui.viewT.zoom), '1×');

  const footer = { textContent: '' };
  const land = { textContent: '' };
  ui.view = ui.viewT;
  ui.pbZoomRef = { current: footer };
  ui.rootRef = { current: { querySelectorAll: () => [footer, land] } };
  ui.syncViewUI();
  assert.equal(footer.textContent, '1×');
  assert.equal(land.textContent, '1×', 'the landscape Tools label matches the footer');
});

test('a double past the zoom cap is skipped, and the cycle still returns to 1×', () => {
  const ui = phone();
  const fill = at(ui, 360, 1000);
  assert.ok(fill.zoom * 2 <= cam.MAX_ZOOM + 1e-3);
  assert.ok(fill.zoom * 4 > cam.MAX_ZOOM, '4× of this fill does not fit');
  assert.equal(ui.zoomLabel(ui.viewT.zoom), '1×');

  ui.cycleZoom();
  assert.ok(Math.abs(ui.viewT.zoom / fill.zoom - 2) < 0.05);
  assert.equal(ui.zoomLabel(ui.viewT.zoom), '2×');

  ui.cycleZoom();
  assert.ok(ui.viewT.zoom < 1.05, '4× is not a stop, so the next press is the whole vessel');
  assert.equal(ui.zoomLabel(ui.viewT.zoom), '⊕');

  ui.cycleZoom();
  assert.ok(Math.abs(ui.viewT.zoom - fill.zoom) < 0.05);
  assert.equal(ui.zoomLabel(ui.viewT.zoom), '1×');
});

test('a quick two-finger tap toggles fit and a close-up; a slow or moving pinch does not', () => {
  const m = method('pinchEnd');
  assert.match(m, /if \(!pc\.moved && performance\.now\(\) - pc\.at < 320\)/);
  assert.match(m, /fillZ \* TAP_ZOOM/, 'close-up is a multiple of the fill, not an absolute zoom');
  assert.match(m, /this\.zoomBy\(close \/ v\.zoom, pc\.mx, pc\.my\)/, 'close-up lands where the fingers tapped');
  assert.match(html, /if \(Math\.abs\(ratio - 1\) > 0\.08 \|\| Math\.hypot\(mx - pc\.mx0, my - pc\.my0\) > 12\) pc\.moved = true;/);
  assert.match(html, /if \(this\.gesture === 'pinch' && this\.pinch\) this\.pinchEnd\(this\.pinch\);/, 'only the first lifted finger ends the pinch');
});

test('a pinch released near a whole zoom snaps to it', () => {
  const m = method('pinchEnd');
  assert.match(html, /SNAP_ZOOM = 0\.12/);
  assert.match(m, /Math\.abs\(v\.zoom - whole\) < SNAP_ZOOM\) this\.zoomBy\(whole \/ v\.zoom, pc\.mx, pc\.my\)/);
  assert.match(m, /pc\.moved && pc\.vel && this\.glide\) this\.glide\.kick\(pc\.vel\.x, pc\.vel\.y\)/, 'a moving pinch glides after release');
  assert.match(html, /sampleVelocity\(pc\.vel, mx, my, performance\.now\(\)\)/);
  assert.match(html, /touch\.cancel\(\)/, 'the second finger cancels the pour before the pinch');
});

test('the vessel itself stays free of zoom buttons on phones', () => {
  assert.match(html, /@media\(max-width:700px\),\(pointer:coarse\)\{\.zoom-buttons\{display:none/);
  assert.match(html, /Two-finger tap to zoom in or out/);
});
