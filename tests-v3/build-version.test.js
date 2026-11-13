import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInfo } from '../scripts/build-info.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const html = readFileSync(new URL('../public/v3/index.html', import.meta.url), 'utf8');

test('Turning Valley loads the build stamp and shows it in the valley menu', () => {
  assert.ok(html.includes('<script src="../build-info.js"></script>'));
  const menu = html.slice(html.indexOf('<div class="menu">'), html.indexOf('</details>'));
  assert.match(menu, /<p class="build-label" data-build-label><\/p>/);
  assert.equal(buildInfo({}).label, `v${pkg.version}`);
});
