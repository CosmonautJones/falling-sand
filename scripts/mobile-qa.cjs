/* Run against Vite, with Playwright available or PLAYWRIGHT_MODULE pointing to it.
 * Instrumentation exists only in the intercepted dev response, never the build. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.QA_CHANNEL || 'chrome',
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/src/main.ts*', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        'const renderer = new Renderer(canvas, grid);',
        'const renderer = new Renderer(canvas, grid); window.__qa = {grid, renderer, get view(){return view}, get painting(){return painting}};',
      );
      await route.fulfill({ response, body });
    });
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5179/');
    await page.waitForFunction(() => document.querySelector('#curtain')?.classList.contains('gone'));
    await page.getByRole('button', { name: 'pause', exact: true }).tap();
    const cells = () => page.evaluate(() => Array.from(window.__qa.grid.cells));
    const before = await cells();
    await page.getByRole('button', { name: 'Try water + lava', exact: true }).tap();
    assert.deepEqual(await cells(), before, 'The invitation must preserve the world');
    assert.equal(
      await page.getByRole('button', { name: 'water', exact: true }).getAttribute('aria-pressed'),
      'true',
    );
    assert.equal(await page.evaluate(() => window.__qa.view.zoom), 3);
    const client = await context.newCDPSession(page);
    const touch = (type, points) =>
      client.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map(([x, y]) => ({ x, y, id: 1 })),
      });
    const box = await page.locator('#viewport').boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.getByRole('button', { name: 'move view', exact: true }).tap();
    const oldView = await page.evaluate(() => ({ ...window.__qa.view }));
    await touch('touchStart', [[x, y]]);
    await page.waitForTimeout(80);
    await touch('touchMove', [[x + 35, y + 20]]);
    await page.waitForTimeout(80);
    await touch('touchEnd', []);
    // Give the browser's touch gesture recognizer a frame to finish before a new tap.
    await page.waitForTimeout(100);
    assert.deepEqual(await cells(), before, 'Panning must not paint');
    assert.notDeepEqual(await page.evaluate(() => window.__qa.view), oldView);
    await page.getByRole('button', { name: 'stone', exact: true }).tap();
    await page.waitForFunction(
      () => document.querySelector('#palette button[aria-pressed="true"]')?.textContent === 'stone',
    );
    assert.equal(
      await page
        .getByRole('button', { name: 'move view', exact: true })
        .getAttribute('aria-pressed'),
      'false',
    );
    await touch('touchStart', [[x, y]]);
    await touch('touchMove', [[x + 25, y - 15]]);
    await touch('touchCancel', []);
    assert.notDeepEqual(await cells(), before, 'Touch drag must paint');
    assert.equal(await page.evaluate(() => window.__qa.painting), false);
    const afterCancel = await cells();
    await page.waitForTimeout(150);
    assert.deepEqual(await cells(), afterCancel, 'Canceled touch must stop painting');
    const layouts = [];
    await fs.mkdir('qa-shots', { recursive: true });
    for (const [width, height] of [
      [390, 844],
      [375, 667],
      [844, 390],
      [667, 375],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100);
      assert.deepEqual(await cells(), afterCancel, 'Rotation must preserve every grain');
      const layout = await page.evaluate(() => {
        const r = document.querySelector('#viewport').getBoundingClientRect();
        const buttons = [...document.querySelectorAll('#toolbar button:not([hidden])')];
        return {
          w: innerWidth,
          h: innerHeight,
          overflow: document.documentElement.scrollWidth > innerWidth,
          canvas: { x: r.x, y: r.y, width: r.width, height: r.height },
          targets: buttons.every(
            (b) => b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().width >= 44,
          ),
        };
      });
      assert.equal(layout.overflow, false);
      assert.equal(layout.targets, true);
      assert.ok(
        layout.canvas.x >= 0 &&
          layout.canvas.y >= 0 &&
          layout.canvas.x + layout.canvas.width <= width + 1 &&
          layout.canvas.y + layout.canvas.height <= height + 1,
      );
      await page.getByRole('button', { name: 'codex', exact: true }).tap();
      await page.getByRole('button', { name: 'close', exact: true }).tap();
      await page.getByRole('button', { name: 'whole vessel', exact: true }).tap();
      assert.equal(await page.evaluate(() => window.__qa.view.zoom), 1);
      await page.getByRole('button', { name: 'zoom in', exact: true }).tap();
      assert.equal(await page.evaluate(() => window.__qa.view.zoom), 1.5);
      await page.getByRole('button', { name: 'zoom out', exact: true }).tap();
      assert.equal(await page.evaluate(() => window.__qa.view.zoom), 1);
      await page.getByRole('button', { name: 'Try water + lava', exact: true }).tap();
      await page.screenshot({ path: `qa-shots/mobile-${width}x${height}.png` });
      layouts.push(layout);
    }
    await page.getByRole('button', { name: 'reset', exact: true }).tap();
    await page.getByRole('button', { name: 'Try water + lava', exact: true }).tap();
    const pourPoint = await page.evaluate(() => {
      const r = document.querySelector('#viewport').getBoundingClientRect();
      const v = window.__qa.view;
      return [
        r.x + (422 / 480) * r.width * v.zoom + v.panX,
        r.y + (240 / 270) * r.height * v.zoom + v.panY,
      ];
    });
    await page.getByRole('button', { name: 'play', exact: true }).tap();
    await page.evaluate(async () => {
      const { Material } = await import('/src/materials.ts');
      window.__peakSteam = 0;
      window.__steamSample = setInterval(() => {
        window.__peakSteam = Math.max(
          window.__peakSteam,
          window.__qa.grid.cells.filter((id) => id === Material.Steam).length,
        );
      }, 16);
    });
    await touch('touchStart', [pourPoint]);
    await page.waitForTimeout(500);
    await touch('touchEnd', []);
    await page.waitForTimeout(1000);
    const reaction = await page.evaluate(async () => {
      const { Material } = await import('/src/materials.ts');
      const cells = window.__qa.grid.cells;
      return {
        obsidian: cells.filter((id) => id === Material.Obsidian).length,
        peakSteam: window.__peakSteam,
      };
    });
    assert.ok(reaction.obsidian > 0, 'The invited experiment must make obsidian');
    assert.ok(reaction.peakSteam > 0, 'The invited experiment must make steam');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, layouts, reaction, errors }, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
