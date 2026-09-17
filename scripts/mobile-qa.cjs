/* Run against Vite with Playwright and Chrome. State inspection is injected only
 * into the development response; the production build has no QA globals. */
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
        'const renderer = new Renderer(canvas, grid); window.__qa = {grid, get view(){return view}, get painting(){return painting}, pause:()=>setPaused(true)};',
      );
      await route.fulfill({ response, body });
    });
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5179/');
    await page.waitForFunction(() => document.querySelector('#curtain').classList.contains('gone'));
    await page.getByRole('button', { name: 'pause', exact: true }).tap();
    const cells = () => page.evaluate(() => Array.from(window.__qa.grid.cells));
    const opening = await cells();
    const button = (name) => page.getByRole('button', { name, exact: true });
    await fs.mkdir('qa-shots', { recursive: true });
    const layouts = [];
    for (const [width, height] of [
      [390, 844],
      [375, 667],
      [844, 390],
      [667, 375],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100);
      assert.deepEqual(await cells(), opening, 'Rotation preserves the world');
      assert.equal(await page.locator('#palette').isVisible(), false);
      assert.equal(await page.locator('#hud').isVisible(), false);
      const layout = await page.evaluate(() => {
        const r = document.querySelector('#viewport').getBoundingClientRect();
        const canvas = document.querySelector('canvas').getBoundingClientRect();
        return {
          width: innerWidth,
          height: innerHeight,
          playHeight: r.height,
          overflow: document.documentElement.scrollWidth > innerWidth,
          aspect: canvas.width / canvas.height,
        };
      });
      assert.ok(layout.playHeight > height * 0.65, 'Closed controls must leave room to play');
      assert.equal(layout.overflow, false);
      assert.ok(Math.abs(layout.aspect - 480 / 270) < 0.001, 'Grains must not stretch');
      await page.screenshot({ path: `qa-shots/drawer-closed-${width}.png` });
      const camera = await page.locator('#stage').getAttribute('style');
      await button('Materials and brush').tap();
      assert.equal(await page.getByRole('dialog', { name: 'Materials & brush' }).isVisible(), true);
      assert.equal(
        await page.locator('#stage').getAttribute('style'),
        camera,
        'Drawer must not move the camera',
      );
      assert.deepEqual(await cells(), opening, 'Opening a drawer must not paint');
      const targets = await page.locator('#control-drawer button:visible').evaluateAll((buttons) =>
        buttons.every((b) => {
          const r = b.getBoundingClientRect();
          return r.width >= 44 && r.height >= 44;
        }),
      );
      assert.equal(targets, true, 'Drawer targets must remain touch-sized');
      await button('size 3').tap();
      assert.equal(await page.locator('#brush-radius').textContent(), 'Size 3');
      await page.screenshot({ path: `qa-shots/drawer-open-${width}.png` });
      await button('water').tap();
      assert.equal(await page.locator('#control-drawer').evaluate((d) => d.open), false);
      assert.equal(await page.locator('#brush-current').textContent(), 'water');
      await button('More').tap();
      await button('whole vessel').tap();
      assert.equal(await page.locator('#control-drawer').evaluate((d) => d.open), false);
      assert.equal(await page.evaluate(() => window.__qa.view.zoom), 1);
      await button('More').tap();
      await button('codex').tap();
      await page.waitForTimeout(50);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      assert.equal(
        await page.evaluate(() => !!document.activeElement.closest('#folio')),
        true,
        'Codex must contain keyboard focus',
      );
      await button('close').tap();
      await button('More').tap();
      await button('clear').tap();
      assert.equal(await page.getByRole('dialog', { name: 'Empty the vessel?' }).isVisible(), true);
      await button('Keep playing').tap();
      assert.deepEqual(await cells(), opening, 'Canceling clear must preserve the world');
      await button('Materials and brush').tap();
      await page.keyboard.press('Escape');
      assert.equal(
        await button('Materials and brush').evaluate((b) => b === document.activeElement),
        true,
      );
      layouts.push(layout);
    }
    // Collapse desktop/mobile while the drawer is open: no orphaned modal or duplicate controls.
    await button('Materials and brush').tap();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#control-drawer').evaluate((d) => d.open), false);
    assert.equal(await page.locator('#palette').isVisible(), true);
    assert.equal(await button('water').count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    await button('More').tap();
    await button('Try water + lava').tap();
    assert.deepEqual(await cells(), opening, 'The invitation must preserve the world');
    await page.evaluate(() => window.__qa.grid.clear());
    await button('Materials and brush').tap();
    await button('stone').tap();
    const client = await context.newCDPSession(page);
    const touch = (type, points) =>
      client.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map(([x, y, id]) => ({ x, y, id })),
      });
    const r = await page.locator('#viewport').boundingBox();
    const x = r.x + r.width * 0.4,
      y = r.y + r.height * 0.4;
    await touch('touchStart', [[x, y, 1]]);
    await page.waitForTimeout(80);
    assert.ok(
      (await cells()).some((id) => id !== 0),
      'A single finger pours',
    );
    await touch('touchStart', [
      [x, y, 1],
      [x + 70, y, 2],
    ]);
    await page.waitForTimeout(80);
    const beforePinch = await cells();
    const oldZoom = await page.evaluate(() => window.__qa.view.zoom);
    await touch('touchMove', [
      [x - 25, y + 25, 1],
      [x + 100, y + 25, 2],
    ]);
    await page.waitForTimeout(80);
    assert.deepEqual(await cells(), beforePinch, 'Two fingers must not paint');
    assert.ok((await page.evaluate(() => window.__qa.view.zoom)) > oldZoom, 'Pinch must zoom');
    await touch('touchEnd', [[x - 25, y + 25, 1]]);
    await touch('touchMove', [[x - 40, y + 50, 1]]);
    await page.waitForTimeout(80);
    assert.deepEqual(await cells(), beforePinch, 'Lifting one finger must not resume pouring');
    await touch('touchEnd', []);
    await page.waitForTimeout(100);
    await touch('touchStart', [[x + 10, y - 20, 1]]);
    await touch('touchMove', [[x + 40, y - 40, 1]]);
    await touch('touchCancel', []);
    const afterCancel = await cells();
    assert.notDeepEqual(afterCancel, beforePinch, 'A fresh single-finger gesture paints again');
    await page.waitForTimeout(150);
    assert.deepEqual(await cells(), afterCancel, 'Cancel stops held painting');
    await button('More').tap();
    await button('move view').tap();
    await touch('touchStart', [[x, y, 1]]);
    await page.waitForTimeout(80);
    await touch('touchMove', [[x + 40, y + 20, 1]]);
    await touch('touchEnd', []);
    await page.waitForTimeout(100);
    assert.deepEqual(await cells(), afterCancel, 'The button alternative pans without painting');
    await button('Materials and brush').tap();
    await page.touchscreen.tap(20, 60);
    assert.equal(await page.locator('#control-drawer').evaluate((d) => d.open), false);
    assert.deepEqual(await cells(), afterCancel, 'Dismissing the backdrop must not paint');
    await button('More').tap();
    await button('clear').tap();
    await button('Clear vessel').tap();
    assert.ok(
      (await cells()).every((id) => id === 0),
      'Confirmed clear empties the vessel',
    );
    await button('More').tap();
    await button('reset').tap();
    await button('Reset vessel').tap();
    assert.ok(
      (await cells()).some((id) => id !== 0),
      'Confirmed reset restores the opening scene',
    );
    assert.equal(
      (await cells()).filter((id) => id === 33).length,
      4,
      'Reset restores the four mites',
    );
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, layouts, errors }, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
