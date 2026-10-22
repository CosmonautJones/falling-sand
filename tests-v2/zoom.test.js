import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const bar = html.slice(html.indexOf('<nav class="phone-bar"'), html.indexOf('</nav>'));
const method = name => { const i = html.indexOf(`  ${name}(`); return html.slice(i, html.indexOf('\n  }\n', i)); };

test('the phone bar doubles the fill, skips a step past the cap, then returns to 1×', () => {
  assert.match(bar, /data-phone="zoom"[^>]*onClick="\{\{ cycleZoom \}\}"/);
  assert.match(html, /ZOOM_STEPS = \[2, 4\]/);
  const m = method('cycleZoom');
  assert.match(m, /defaultView\(this\.vw, this\.vh\)/, '1× is the height-filling view');
  assert.match(m, /\[\s*1,\s*\.\.\.ZOOM_STEPS\s*\]/);
  assert.match(m, /filter\(z => z <= cap \+ 1e-3\)/, 'a double past the cap is not a stop');
  assert.match(m, /this\.zoomBy\(next \/ v\.zoom, this\.vw \/ 2, this\.vh \/ 2\)/, 'zooms around the middle of the view');
  assert.match(m, /this\.setView\(fill, true\)/, 'the press after the whole vessel restores the 1× fill');
  assert.match(m, /setView\(\{ zoom: 1, panX: 0, panY: 0 \}, true\)/, 'the whole vessel is still a stop');
  const label = method('zoomLabel');
  assert.match(label, /return '⊕'/, 'the whole vessel reads ⊕');
  assert.match(label, /return '1×'/, 'the height-filling view reads 1×');
  assert.match(html, /pz\.textContent = this\.zoomLabel\(v\.zoom\)/);
  assert.match(html, /this\.zoomSuffix\(z\)/);
  assert.match(html, /this\.zoomSuffix\(v\.zoom\)/);
  assert.match(html, /Math\.min\(this\.cam\.MAX_ZOOM, Math\.max\(this\.cam\.MIN_ZOOM, pc\.zoom \* ratio\)\)/);
  assert.equal(html.includes('Math.min(12, Math.max(1, pc.zoom * ratio))'), false, 'pinch uses the camera cap');
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
