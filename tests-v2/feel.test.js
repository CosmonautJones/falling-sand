import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const html = readFileSync(new URL('../public/v2/index.html', import.meta.url), 'utf8');
const m = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);

test('module script is extractable and syntactically valid', () => {
  assert.ok(m, 'x-dc script block found');
  const dir = mkdtempSync(join(tmpdir(), 'feel-'));
  const file = join(dir, 'script.mjs');
  writeFileSync(file, m[1]);
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('pour ops carry optional fling velocity (vx/vy), conditionally', () => {
  assert.match(html, /flingFields\s*\(/);
  assert.match(html, /vx\b/);
  assert.match(html, /vy\b/);
  // spread of a conditional helper keeps ops backward compatible
  assert.match(html, /t: 'l',[^\n]*\.\.\.this\.flingFields\(\)/);
  assert.match(html, /t: 'p',[^\n]*\.\.\.this\.flingFields\(\)/);
  const fn = html.match(/flingFields\s*\(\)\s*\{[^\n]*\n?[\s\S]*?\n  \}/);
  assert.ok(fn, 'flingFields defined');
  assert.match(fn[0], /return \{\}/, 'omits fields when speed is tiny');
  assert.match(html, /trackFling[\s\S]*?Math\.max\(-6, Math\.min\(6/, 'clamped to +-6');
});

test('blast haptics: single guarded vibrate, honours reduced motion', () => {
  const calls = html.match(/navigator\.vibrate\(/g) || [];
  assert.equal(calls.length, 1, 'exactly one vibrate call');
  const line = html.split('\n').find(l => l.includes('navigator.vibrate('));
  assert.match(line, /typeof navigator !== 'undefined'/);
  assert.match(line, /!this\.still/);
  assert.match(line, /r\.kick|kick/);
});
