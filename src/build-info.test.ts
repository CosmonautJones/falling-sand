import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_COMMIT, APP_VERSION, versionLabel } from './build-info';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

describe('build stamp', () => {
  it('injects the package.json version at build time', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(versionLabel()).toBe(`v${pkg.version}${APP_COMMIT ? ` · ${APP_COMMIT}` : ''}`);
  });

  it('adds the short commit only when the build host provides one', () => {
    expect(versionLabel('1.2.3', '')).toBe('v1.2.3');
    expect(versionLabel('1.2.3', 'abc1234')).toBe('v1.2.3 · abc1234');
  });

  it('shows the label on the classic page', () => {
    const html = readFileSync(new URL('../classic.html', import.meta.url), 'utf8');
    const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
    expect(html).toMatch(/<span id="build" class="build-label"><\/span>/);
    expect(main).toContain("requireEl<HTMLSpanElement>('#build')");
    expect(main).toContain('buildStamp.textContent = versionLabel()');
  });
});
