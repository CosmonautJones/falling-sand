import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const bindInput = html.slice(html.indexOf('bindInput() {'), html.indexOf('// ---------- rites'));

test('viewport meta covers the notch and iOS web-app chrome', () => {
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.match(html, /name="apple-mobile-web-app-capable"/);
  assert.match(html, /name="mobile-web-app-capable"/);
  assert.match(html, /name="apple-mobile-web-app-status-bar-style"/);
  assert.match(html, /name="theme-color"/);
});

test('vessel and canvas suppress browser touch gestures', () => {
  assert.match(html, /<div ref="\{\{ vpRef \}\}"[^>]*touch-action:none/);
  assert.match(html, /<canvas ref="\{\{ cvRef \}\}"[^>]*touch-action:none/);
  assert.match(html, /-webkit-touch-callout:none/);
  assert.match(html, /-webkit-user-select:none/);
  assert.match(html, /user-select:none/);
  assert.match(html, /overscroll-behavior:none/);
  assert.match(html, /touch-action:manipulation/);
});

test('layout respects safe-area insets and dynamic viewport height', () => {
  assert.match(html, /env\(safe-area-inset-top\)/);
  assert.match(html, /env\(safe-area-inset-bottom\)/);
  assert.match(html, /env\(safe-area-inset-left\)/);
  assert.match(html, /env\(safe-area-inset-right\)/);
  assert.match(html, /100dvh/);
});

test('phone media queries exist for narrow and short-landscape screens', () => {
  assert.match(html, /@media[^{]*max-width:\s*700px/);
  assert.match(html, /@media[^{]*orientation:\s*landscape[^{]*max-height/);
  assert.match(html, /@media[^{]*pointer:\s*coarse/);
});

test('long-press probes the grain: timer plus movement threshold in bindInput', () => {
  assert.ok(bindInput.length > 500, 'bindInput located');
  assert.match(bindInput, /setTimeout\([\s\S]{0,900}?450\)/, '450ms long-press timer');
  assert.match(bindInput, /pointerType === 'touch'/);
  assert.match(bindInput, /clearTimeout/);
  assert.match(bindInput, /longPress|lpTimer/);
  assert.match(bindInput, /Math\.hypot\([^)]*\)\s*>\s*8/, 'movement threshold cancels it');
  assert.match(bindInput, /showProbe\(/);
});

test('two-finger pinch also pans (midpoint tracked)', () => {
  assert.match(bindInput, /panX: mx - pc\.gx/);
});

test('render DPR is capped at 2', () => {
  assert.match(html, /Math\.min\(window\.devicePixelRatio \|\| 1, 2\)/);
});
