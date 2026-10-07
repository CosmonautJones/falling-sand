import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const markup = html.slice(0, html.indexOf('<script type="text/x-dc"'));
const vessel = markup.slice(markup.indexOf('<div ref="{{ vpRef }}"'), markup.indexOf('</figure>'));
const bindInput = html.slice(html.indexOf('bindInput() {'), html.indexOf('// ---------- rites'));

test('phone bar: element dropdown, brush, pause and an options menu', () => {
  const bar = markup.slice(markup.indexOf('class="phone-bar"'));
  assert.ok(markup.includes('class="phone-bar"'), 'phone bar exists');
  assert.match(bar, /data-phone="element"[^>]*aria-haspopup="dialog"/);
  assert.match(bar, /data-phone="brush"/);
  assert.match(bar, /data-phone="pause"/);
  assert.match(bar, /data-phone="options"[^>]*aria-haspopup="dialog"/);
});

test('element sheet lists discovered reagents as a grid and points at the blanks', () => {
  const sheet = markup.slice(markup.indexOf('data-sheet="elements"'));
  assert.ok(markup.includes('data-sheet="elements"'));
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /<sc-for list="\{\{ starterTiles \}\}"/);
  assert.match(sheet, /<sc-for list="\{\{ foundTiles \}\}"/);
  assert.match(sheet, /\{\{ blankNote \}\}/);
});

test('options sheet groups tool, size, speed, vessel, capture, sound, library and fullscreen', () => {
  const sheet = markup.slice(markup.indexOf('data-sheet="options"'));
  assert.ok(markup.includes('data-sheet="options"'));
  for (const list of ['tools', 'sizes', 'clocks']) assert.match(sheet, new RegExp(`list="\\{\\{ ${list} \\}\\}"`));
  for (const h of ['onClear', 'onReset', 'onShot', 'onClip', 'toggleSound', 'openCodex', 'openRites', 'openFlasks', 'toggleScreen']) assert.ok(sheet.includes(`{{ ${h} }}`), h);
});

test('sheets close on backdrop, Escape, and after a pick', () => {
  assert.match(markup, /class="sheet-backdrop"[^>]*onClick="\{\{ closeSheet \}\}"/);
  assert.match(html, /e\.key === 'Escape' && this\.state\.sheet/);
  assert.match(html, /pickElement\(id\)\s*\{[^}]*sheet: ''/);
});

test('on phones the zoom buttons leave the vessel and the HUD sits outside it', () => {
  assert.match(html, /@media\(max-width:700px\),\(pointer:coarse\)\{[^}]*\.zoom-buttons\{display:none/);
  assert.ok(markup.includes('data-phone-hud'), 'phone HUD exists');
  assert.ok(!vessel.includes('data-phone-hud'), 'phone HUD is not drawn over the vessel');
  assert.match(html, /phoneHud\.textContent =/);
});

test('mini-map hides itself shortly after the view stops moving', () => {
  assert.match(html, /clearTimeout\(this\.miniHideT\)/);
  assert.match(html, /this\.miniHideT = setTimeout\(/);
});

test('touch input goes through the tested touch-pour gesture', () => {
  assert.match(html, /touch-gesture\.js/);
  assert.match(bindInput, /createTouchPour\(/);
  assert.match(bindInput, /touch\.down\(/);
  assert.match(bindInput, /touch\.move\(/);
  assert.match(bindInput, /touch\.cancel\(\)/);
});

test('phone layout gives the vessel the full width and a side rail in landscape', () => {
  assert.match(html, /@media\(max-width:700px\)[^{]*\{[^]*?\.fig\{[^}]*padding:0/);
  assert.match(html, /@media\(orientation:landscape\) and \(max-height:520px\)\{[^]*?\.phone-bar\{[^}]*flex-direction:column/);
});
