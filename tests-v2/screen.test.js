import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleScreen } from '../public/v2/mobile-screen.js';
function fixture(requestFullscreen) {
  const attrs = new Set();
  const root = { hasAttribute: k => attrs.has(k), toggleAttribute: (k,v) => v ? attrs.add(k) : attrs.delete(k), requestFullscreen };
  return { root, doc: { fullscreenElement: null }, attrs };
}
test('unsupported fullscreen enters and exits immersive mode', async () => {
  const {root,doc,attrs} = fixture();
  await toggleScreen(root,doc); assert.ok(attrs.has('data-immersive'));
  await toggleScreen(root,doc); assert.equal(attrs.size,0);
});
test('rejected native fullscreen retains the usable immersive fallback', async () => {
  const {root,doc,attrs} = fixture(async () => { throw new Error('unsupported'); });
  await toggleScreen(root,doc); assert.ok(attrs.has('data-immersive'));
});
test('native fullscreen is requested and can be exited', async () => {
  let entered = 0, exited = 0;
  const {root,doc,attrs} = fixture(async () => { entered++; doc.fullscreenElement = root; });
  doc.exitFullscreen = async () => { exited++; doc.fullscreenElement = null; };
  await toggleScreen(root,doc); assert.equal(entered,1);
  await toggleScreen(root,doc); assert.equal(exited,1); assert.equal(attrs.size,0);
});
