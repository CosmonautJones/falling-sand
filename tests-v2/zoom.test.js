import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const bar = html.slice(html.indexOf('<nav class="phone-bar"'), html.indexOf('</nav>'));
const method = name => { const i = html.indexOf(`  ${name}(`); return html.slice(i, html.indexOf('\n  }\n', i)); };

test('the phone bar has a thumb zoom button that steps 2×, 4×, then fits', () => {
  assert.match(bar, /data-phone="zoom"[^>]*onClick="\{\{ cycleZoom \}\}"/);
  assert.match(html, /ZOOM_STEPS = \[2, 4\]/);
  const m = method('cycleZoom');
  assert.match(m, /ZOOM_STEPS\.find\(z => z > v\.zoom \+ 0\.05\) \|\| 1/);
  assert.match(m, /this\.zoomBy\(next \/ v\.zoom, this\.vw \/ 2, this\.vh \/ 2\)/, 'zooms around the middle of the view');
  assert.match(html, /pz\.textContent = v\.zoom < 1\.05 \? '⊕'/, 'the button shows the current zoom');
});

test('a quick two-finger tap toggles fit and a close-up; a slow or moving pinch does not', () => {
  const m = method('pinchEnd');
  assert.match(m, /if \(!pc\.moved && performance\.now\(\) - pc\.at < 320\)/);
  assert.match(m, /this\.zoomBy\(TAP_ZOOM \/ v\.zoom, pc\.mx, pc\.my\)/, 'close-up lands where the fingers tapped');
  assert.match(html, /if \(Math\.abs\(ratio - 1\) > 0\.08 \|\| Math\.hypot\(mx - pc\.mx0, my - pc\.my0\) > 12\) pc\.moved = true;/);
  assert.match(html, /if \(this\.gesture === 'pinch' && this\.pinch\) this\.pinchEnd\(this\.pinch\);/, 'only the first lifted finger ends the pinch');
});

test('a pinch released near a whole zoom snaps to it', () => {
  const m = method('pinchEnd');
  assert.match(html, /SNAP_ZOOM = 0\.12/);
  assert.match(m, /Math\.abs\(v\.zoom - whole\) < SNAP_ZOOM\) this\.zoomBy\(whole \/ v\.zoom, pc\.mx, pc\.my\)/);
});

test('the vessel itself stays free of zoom buttons on phones', () => {
  assert.match(html, /@media\(max-width:700px\),\(pointer:coarse\)\{\.zoom-buttons\{display:none/);
  assert.match(html, /Two-finger tap to zoom in or out/);
});
