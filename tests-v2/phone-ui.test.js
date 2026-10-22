import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const markup = html.slice(0, html.indexOf('<script type="text/x-dc"'));
const vessel = markup.slice(markup.indexOf('<div ref="{{ vpRef }}"'), markup.indexOf('</figure>'));
const bindInput = html.slice(html.indexOf('bindInput() {'), html.indexOf('// ---------- rites'));

test('phone chrome: material orb, brush, pause and an options menu', () => {
  const bar = markup.slice(markup.indexOf('class="touch-chrome"'));
  assert.ok(markup.includes('class="touch-chrome"'), 'touch chrome exists');
  assert.ok(!vessel.includes('class="touch-chrome"'), 'touch chrome is not inside the vessel');
  assert.match(bar, /data-phone="element"[^>]*data-suggest="\{\{ suggesting \}\}"[^>]*aria-haspopup="dialog"/);
  assert.match(bar, /data-phone="brush"/);
  assert.match(bar, /data-phone="pause"/);
  assert.match(bar, /data-phone="options"[^>]*aria-haspopup="dialog"/);
  assert.match(bar, /onPointerDown="\{\{ orbDown \}\}"/);
  assert.match(html, /HOLD_MS/);
});

test('one sheet lists families, a search, and points at the blanks', () => {
  const sheet = markup.slice(markup.indexOf('data-sheet="studio"'));
  assert.ok(markup.includes('data-sheet="studio"'));
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /data-sheet="elements"/);
  assert.match(sheet, /<sc-for list="\{\{ families \}\}"/);
  assert.match(sheet, /<sc-for list="\{\{ fam\.tiles \}\}"/);
  assert.match(sheet, /placeholder="\{\{ searchPlaceholder \}\}"/);
  assert.match(sheet, /\{\{ blankNote \}\}/);
  assert.match(sheet, /Elements<\/button>/);
  assert.match(sheet, /Tools<\/button>/);
  assert.match(sheet, /Vessel<\/button>/);
  assert.match(sheet, /Codex<\/button>/);
});

test('the merged sheet keeps tool, size, speed, vessel, capture, sound, library and fullscreen', () => {
  const sheet = markup.slice(markup.indexOf('data-sheet="studio"'));
  for (const list of ['tools', 'sizes', 'clocks']) assert.match(sheet, new RegExp(`list="\\{\\{ ${list} \\}\\}"`));
  for (const h of ['onClear', 'onReset', 'onShot', 'onClip', 'toggleSound', 'openCodex', 'openRites', 'openFlasks', 'toggleScreen']) assert.ok(sheet.includes(`{{ ${h} }}`), h);
});

test('sheets close on backdrop, Escape, and after a pick', () => {
  assert.match(markup, /class="sheet-backdrop"[^>]*onClick="\{\{ closeSheet \}\}"/);
  assert.match(html, /e\.key === 'Escape' && this\.state\.sheet/);
  assert.match(html, /pickElement\(id\)\s*\{[^}]*sheet: ''/);
});

test('on phones the zoom buttons leave the vessel and the pills sit outside it', () => {
  assert.match(html, /@media\(max-width:700px\),\(pointer:coarse\)\{[^}]*\.zoom-buttons\{display:none/);
  assert.ok(markup.includes('data-phone="almanac"'), 'almanac pill exists');
  assert.ok(markup.includes('data-phone="tally"'), 'discovery pill exists');
  assert.ok(!vessel.includes('data-phone="almanac"'), 'pills are not drawn inside the vessel');
  assert.match(html, /toggleAttribute\('data-idle'/);
  assert.match(html, /createIdleChrome\(/);
  assert.match(html, /addEventListener\('pointerdown', down, \{ passive: true, capture: true \}\)/);
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
  assert.match(html, /\.top-pills\{left:calc\(172px \+ env\(safe-area-inset-left\)\)/);
});
