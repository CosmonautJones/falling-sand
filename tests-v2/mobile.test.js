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

test('a touch screen fills the dynamic viewport and parks the minimap in the safe area', () => {
  const at = html.indexOf('/* touch-fill');
  const block = at < 0 ? '' : html.slice(at);
  assert.ok(at >= 0, 'touch-fill layout is present');
  assert.match(block, /\.fig\{[^}]*width:100vw/);
  assert.match(block, /\.fig\{[^}]*height:100dvh/);
  assert.match(block, /\.zoom-controls\{[^}]*env\(safe-area-inset-top\)/);
  assert.match(block, /\.zoom-controls\{[^}]*env\(safe-area-inset-right\)/);
  assert.match(block, /\.orb-wrap\{[^}]*env\(safe-area-inset-bottom\)/);
  assert.match(block, /\.orb-wrap\{[^}]*env\(safe-area-inset-left\)/);
  assert.match(block, /\.zoom-mini\{[^}]*opacity:1/);
  assert.match(html, /viewport-fit=cover/);
});

test('a landscape rail grows by the left inset and the toast clears the whisper', () => {
  assert.match(html, /\.top-pills\{[^}]*left:calc\(172px \+ env\(safe-area-inset-left\)\)/);
  assert.match(html, /\.hd\{[^}]*left:calc\(172px \+ env\(safe-area-inset-left\)\)/);
  assert.match(html, /\.sheet\{[^}]*left:calc\(172px \+ env\(safe-area-inset-left\)\)/);
  assert.match(html, /\.experiment-card\{[^}]*left:calc\(172px \+ env\(safe-area-inset-left\)\)/);
  assert.match(html, /data-safe-right/);
  assert.match(html, /\.toast\{top:calc\(max\(8px, env\(safe-area-inset-top\)\) \+ 86px\)!important\}/);
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
  assert.match(bindInput, /pc\.mx = mx; pc\.my = my;/);
  assert.match(bindInput, /viewFromAnchor\(this\.vw, this\.vh, zoom, mx, my, pc\.gx, pc\.gy\)/);
});

test('a wide coarse screen caps the sheet and fills tile columns', () => {
  assert.match(html, /@media \(pointer:coarse\) and \(min-width:701px\) and \(min-height:521px\)/);
  assert.match(html, /width:min\(560px,calc\(100% - 32px\)\)/);
  assert.match(html, /repeat\(auto-fill,minmax\(104px,1fr\)\)/);
  assert.match(html, /sheetGuardUntil = performance\.now\(\) \+ 350/);
  assert.match(html, /chromeCover\(\) \{[\s\S]*?\.orb, \.size-orb, \.rb, \.rec, \.sheet-handle/);
  assert.match(html, /\.pour-hint\{left:auto;right:max\(84px,calc\(env\(safe-area-inset-right\) \+ 72px\)\)/);
});

test('touch backing-store DPR is capped at 1 and a fine pointer stays at 2', () => {
  assert.match(html, /const dpr = window\.devicePixelRatio \|\| 1;/);
  assert.match(html, /const s = Math\.min\(dpr, this\.coarse \? 1 : 2\);/);
  assert.match(html, /480×1039/, 'the fit boost, not the CSS viewport, sizes the touch buffer');
});
