import { expect, test, type Locator, type Page } from '@playwright/test';

const position = (port: Locator) => port.evaluate((node) => node.scrollTop);

// Authored Markdown evolves independently of the UI; supply overflow for short content only.
async function ensureOverflow(port: Locator) {
  await port.evaluate((node) => {
    if (node.scrollHeight - node.clientHeight > 600) return;
    const content = node.querySelector<HTMLElement>('[data-other-panel]:not([hidden])') ?? node;
    const fixture = document.createElement('div');
    fixture.style.minHeight = '1400px';
    fixture.setAttribute('aria-hidden', 'true');
    content.append(fixture);
  });
}

test.beforeEach(async ({ page }) => {
  // Cross-origin fonts must not gate local interaction tests.
  await page.route(/https?:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//, (route) =>
    route.abort(),
  );
});

async function settleLayout(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function wheelOn(page: Page, port: Locator, delta: number) {
  const bounds = await port.boundingBox();
  if (!bounds) throw new Error('Missing scrollport bounds');
  await page.mouse.move(
    bounds.x + Math.min(bounds.width / 2, 120),
    bounds.y + Math.min(bounds.height / 2, 180),
  );
  await settleLayout(page);
  // Observe delivery without cancelling the native wheel event. The compositor may
  // otherwise race a just-materialized reading panel under Playwright tracing.
  await port.evaluate((node) => {
    node.removeAttribute('data-test-wheel-delivered');
    node.addEventListener('wheel', () => node.setAttribute('data-test-wheel-delivered', 'true'), {
      once: true,
      passive: true,
    });
  });
  await page.mouse.wheel(0, delta);
  await expect(port).toHaveAttribute('data-test-wheel-delivered', 'true');
  await settleLayout(page);
}

async function checkReadingScroll(page: Page, port: Locator) {
  await expect(page.locator('html')).toHaveAttribute('data-shortcuts', 'on');
  await expect(port).toBeVisible();
  expect(await port.evaluate((node) => getComputedStyle(node).overflowY)).toBe('auto');
  await ensureOverflow(port);
  expect(await port.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeGreaterThan(160);
  await port.evaluate((node) => (node.scrollTop = 0));
  await settleLayout(page);
  await wheelOn(page, port, 240);
  await expect.poll(() => position(port)).toBeGreaterThan(100);
  const afterWheel = await position(port);
  await page.keyboard.press('j');
  await expect.poll(() => position(port)).toBeGreaterThan(afterWheel);
  await page.keyboard.press('k');
  await expect.poll(() => position(port)).toBe(afterWheel);
  await wheelOn(page, port, -200);
  await expect.poll(() => position(port)).toBeLessThan(afterWheel);
}

for (const mode of ['tui', 'gui']) {
  test(`${mode}: AI uses native and keyboard scrolling on both sides of the desktop breakpoint`, async ({
    page,
  }) => {
    for (const width of [390, 767, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 650 });
      await page.goto(`/other/?ui=${mode}#ai`, { waitUntil: 'domcontentloaded' });
      const port = page.locator(width >= 768 ? '#ai[data-page-scroll]' : '#site-content');
      await checkReadingScroll(page, port);
      if (width >= 768) {
        await expect(page.locator('[data-other-tabs]')).toBeInViewport();
        expect(await position(page.locator('#site-content'))).toBe(0);
      }
    }
  });

  test(`${mode}: home, notes and blog detail use the same reading shortcuts`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 540 });
    for (const path of [
      '/',
      '/notes/obsidian/typescript-utility-types',
      '/notes/obsidian/blogs/my-approach-to-dressing',
    ]) {
      await page.goto(`${path}?ui=${mode}`, { waitUntil: 'domcontentloaded' });
      await checkReadingScroll(page, page.locator('#site-content'));
    }
  });

  test(`${mode}: Other switches between scrollports and restores the reading tab`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 650 });
    await page.goto(`/other/?ui=${mode}#ai`, { waitUntil: 'domcontentloaded' });
    const reading = page.locator('#ai');
    await checkReadingScroll(page, reading);
    await reading.evaluate((node) => (node.scrollTop = 400));
    await page.locator('[data-other-tab="blogroll"]').click();
    await expect(page.locator('#blogroll')).toBeVisible();
    const catalog = page.locator('#blogroll [data-object-scroll]');
    expect(await catalog.evaluate((node) => getComputedStyle(node).overflowY)).toBe('auto');
    await expect(page.locator('#ai')).toBeHidden();
    await page.goBack();
    await expect(reading).toBeVisible();
    await expect.poll(() => position(reading)).toBe(400);
    await page.keyboard.press('j');
    await expect.poll(() => position(reading)).toBeGreaterThan(400);
  });

  test(`${mode}: keyboard navigation resumes at visible catalog rows after wheel scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 580 });
    for (const path of ['/notes/', '/blog/']) {
      await page.goto(`${path}?ui=${mode}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('html')).toHaveAttribute('data-browser-ready', 'true');
      const port = page.locator('[data-object-scroll]:visible');
      const selected = page.locator('[data-object-row][aria-current="true"]:visible');
      // Notes intentionally loads only an initial slice; load more if that slice fits.
      const more = port.locator('[data-object-more]');
      for (
        let i = 0;
        i < 4 &&
        (await more.isVisible()) &&
        (await port.evaluate((node) => node.scrollHeight - node.clientHeight < 360));
        i++
      ) {
        const count = await port.locator('[data-object-row]').count();
        await more.click();
        await expect.poll(() => port.locator('[data-object-row]').count()).toBeGreaterThan(count);
      }
      await port.evaluate((node) => (node.scrollTop = 0));
      const first = port.locator('[data-object-row]').first();
      await first.click({ position: { x: 10, y: 10 } });
      await port.hover({ position: { x: 60, y: 100 } });
      await page.mouse.wheel(0, 400);
      await expect.poll(() => position(port)).toBeGreaterThan(160);
      const afterWheel = await position(port);
      await page.keyboard.press('j');
      await expect(selected).toBeInViewport();
      expect(await position(port)).toBeGreaterThanOrEqual(afterWheel - 80);
      const afterJ = await selected.getAttribute('data-object');
      await page.keyboard.press('j');
      await expect(selected).not.toHaveAttribute('data-object', afterJ ?? '');
      await page.keyboard.press('k');
      await expect(selected).toHaveAttribute('data-object', afterJ ?? '');
    }
  });
}

test('Other authored tabs share the desktop reading scrollport, including tab changes by key', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 650 });
  await page.goto('/other/?ui=tui#ai', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-shortcuts', 'on');
  for (const [key, id] of [
    ['2', 'ideas'],
    ['3', 'canon'],
    ['4', 'colophon'],
    ['5', 'friends'],
  ]) {
    await page.keyboard.press(key);
    const port = page.locator(`#${id}`);
    await expect(port).toBeVisible();
    await checkReadingScroll(page, port);
  }
});

test('mobile Other reading tabs retain their own scroll positions through history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await page.goto('/other/?ui=tui#ai', { waitUntil: 'domcontentloaded' });
  const port = page.locator('#site-content');
  await checkReadingScroll(page, port);
  await port.evaluate((node) => (node.scrollTop = 400));
  await page.keyboard.press('2');
  await expect(page.locator('#ideas')).toBeVisible();
  await expect.poll(() => position(port)).toBe(0);
  await page.goBack();
  await expect(page.locator('#ai')).toBeVisible();
  await expect.poll(() => position(port)).toBe(400);
});

test('a focused desktop preview supports wheel and j/k without changing the selected resource', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 650 });
  await page.goto('/blog/?ui=tui', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-browser-ready', 'true');
  const preview = page.locator('[data-object-preview]:visible');
  const selected = page.locator('[data-object-row][aria-current="true"]:visible');
  const initial = await selected.getAttribute('data-object');
  await ensureOverflow(preview);
  await preview.focus();
  await checkReadingScroll(page, preview);
  await expect(selected).toHaveAttribute('data-object', initial ?? '');
});

test('Dashboard keeps keyboard selection near the visible links after wheel scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 580 });
  await page.goto('/uses/?ui=tui#dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-shortcuts', 'on');
  const port = page.locator('[data-uses-scroll]:visible');
  const first = port.locator('[data-dashboard-target]').first();
  await first.focus();
  await wheelOn(page, port, 360);
  await expect.poll(() => position(port)).toBeGreaterThan(180);
  const afterWheel = await position(port);
  await page.keyboard.press('j');
  await expect(port.locator('[data-dashboard-target]:focus')).toBeInViewport();
  expect(await position(port)).toBeGreaterThanOrEqual(afterWheel - 80);
});
