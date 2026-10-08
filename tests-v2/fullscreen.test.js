import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lockPageGestures } from '../public/v2/gesture-lock.js';
import { toggleScreen } from '../public/v2/mobile-screen.js';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');

function fakeDoc() {
  const handlers = {};
  return {
    handlers,
    addEventListener: (t, fn, opt) => { handlers[t] = { fn, opt }; },
    removeEventListener: (t) => { delete handlers[t]; },
  };
}
const event = (inScroll) => {
  let prevented = false;
  return { target: { closest: sel => (sel === '[data-scroll]' && inScroll ? {} : null) }, preventDefault: () => { prevented = true; }, get prevented() { return prevented; } };
};

test('stray touches outside the vessel and menus never scroll, bounce or zoom the page', () => {
  const doc = fakeDoc();
  const unlock = lockPageGestures(doc);
  assert.equal(doc.handlers.touchmove.opt.passive, false, 'must be able to cancel');
  const outside = event(false); doc.handlers.touchmove.fn(outside); assert.ok(outside.prevented);
  const inMenu = event(true); doc.handlers.touchmove.fn(inMenu); assert.ok(!inMenu.prevented, 'menus still scroll');
  for (const t of ['gesturestart', 'gesturechange']) { const e = event(false); doc.handlers[t].fn(e); assert.ok(e.prevented, `${t} blocked`); }
  unlock();
  assert.deepEqual(Object.keys(doc.handlers), []);
});

test('fullscreen uses the webkit API where that is all there is, and reports what it got', async () => {
  const attrs = new Set();
  const doc = { fullscreenElement: null, webkitFullscreenElement: null };
  let called = 0;
  const root = { hasAttribute: k => attrs.has(k), toggleAttribute: (k, v) => v ? attrs.add(k) : attrs.delete(k), webkitRequestFullscreen: async () => { called++; doc.webkitFullscreenElement = root; } };
  assert.equal(await toggleScreen(root, doc), 'native');
  assert.equal(called, 1);
  doc.webkitExitFullscreen = async () => { doc.webkitFullscreenElement = null; };
  assert.equal(await toggleScreen(root, doc), 'off');
  const bare = { hasAttribute: k => attrs.has(k), toggleAttribute: (k, v) => v ? attrs.add(k) : attrs.delete(k) };
  assert.equal(await toggleScreen(bare, { fullscreenElement: null }), 'immersive', 'iPhone Safari: layout-only');
});

test('a v2 app manifest makes a Home Screen launch truly fullscreen', () => {
  const m = JSON.parse(readFileSync(new URL('../public/v2/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(m.display, 'fullscreen');
  assert.equal(m.start_url, './'); assert.equal(m.scope, './');
  assert.ok(m.icons.length >= 2);
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\.\/icon-192\.png">/);
});

test('the page itself refuses touch gestures; menus opt back in to scrolling', () => {
  assert.match(html, /\.root\{touch-action:none\}/);
  assert.match(html, /\[data-scroll\]\{touch-action:pan-y/);
  assert.match(html, /class="sheet-body" data-scroll/);
  assert.match(html, /lockPageGestures\(document\)/);
});

test('iPhone Safari gets a one-time tip about Add to Home Screen', () => {
  assert.match(html, /Share → Add to Home Screen/);
  assert.match(html, /=== 'immersive' && this\.isIPhoneBrowser\(\)/);
});
