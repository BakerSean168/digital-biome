import { expect, test } from '@playwright/test';

const browser = '[data-object-browser]:visible';
const query = `${browser} [data-object-filter]`;
const selected = `${browser} [data-object-row][aria-current="true"]`;

test.beforeEach(async ({ page }) => {
  // These public browsing checks do not need authentication or remote fonts.
  await page.route('**/api/private/**', (route) => route.fulfill({ status: 401, body: '{}' }));
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
});

test('desktop Tools fills the visible tab and keeps controls outside list scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const catalogs: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/terminal/')) catalogs.push(request.url());
  });
  await page.goto('/tools/?ui=tui');
  await expect(page.locator(`${browser} [data-object-count]`)).toHaveText('22 / 22');
  expect(catalogs.some((url) => url.endsWith('/external.json'))).toBe(false);
  await page.locator('[data-tools-tab="external"]').click();
  await expect.poll(() => page.locator(`${browser} [data-object-row]`).count()).toBeGreaterThan(16);
  const toolbar = await page.locator('[data-tools-tabs]').boundingBox();
  await page.locator(`${browser} [data-object-scroll]`).evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  expect((await page.locator('[data-tools-tabs]').boundingBox())?.y).toBe(toolbar?.y);
  expect(await page.locator('#site-content').evaluate((node) => node.scrollTop)).toBe(0);
  await expect(page.locator(query)).toBeInViewport();
});

test('command prefix gives immediate feedback and cancellation preserves the browser', async ({
  page,
}) => {
  await page.goto('/tools/?ui=tui#external');
  await page.locator(query).fill('github');
  await expect(page.locator(selected)).toContainText(/github/i);
  await page.locator(query).press('Enter');
  const title = await page.locator(`${selected} strong`).innerText();
  await page.keyboard.press('g');
  const feedback = page.locator('[data-command-feedback]');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText('Library');
  await page.keyboard.press('Escape');
  await expect(feedback).toContainText('已取消');
  await expect(page.locator(query)).toHaveValue('github');
  await expect(page.locator(`${selected} strong`)).toHaveText(title);
  await page.keyboard.press('g');
  await page.keyboard.press('f');
  await expect(feedback).toContainText('没有这个命令');
  await expect(page.locator('[data-facet-dialog][open]')).toHaveCount(0);
  await page.keyboard.press('g');
  await expect(feedback).toContainText('Esc 取消');
  await page.evaluate(() =>
    window.addEventListener(
      'keydown',
      (event) => {
        document.documentElement.dataset.tabPrevented = String(event.defaultPrevented);
      },
      { once: true },
    ),
  );
  await page.keyboard.press('Tab');
  expect(await page.locator('html').getAttribute('data-tab-prevented')).toBe('false');
  await expect(feedback).toBeHidden();
});

test('commands expire, clear on focus, offer clickable relations, and can be disabled', async ({
  page,
}) => {
  await page.goto('/tools/?ui=tui');
  const feedback = page.locator('[data-command-feedback]');
  await page.keyboard.press('g');
  await expect(feedback).toContainText('命令已超时', { timeout: 3500 });
  await page.keyboard.press('g');
  await page.locator(query).focus();
  await expect(feedback).toBeHidden();
  await page.locator(query).press('Enter');
  await page.keyboard.press('r');
  const relation = page.locator(`${browser} [data-object-relation]`).first();
  if (await relation.count())
    await expect(feedback).toContainText((await relation.innerText()).replace(/^\[\d+\]\s*/, ''));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '键盘帮助', exact: true }).click();
  await page.getByLabel('启用单字符快捷键').uncheck();
  await page.getByRole('button', { name: '关闭帮助' }).click();
  await page.keyboard.press('g');
  await expect(feedback).toBeHidden();
  await page.reload();
  await page.keyboard.press('g');
  await expect(feedback).toBeHidden();
});

test('boundary J needs two fresh presses and selects the first appended row', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/tools/?ui=tui#external');
  await expect.poll(() => page.locator(`${browser} [data-object-row]`).count()).toBeGreaterThan(16);
  const count = await page.locator(`${browser} [data-object-row]`).count();
  await page.locator(`${browser} [data-object-row]`).last().focus();
  await page.keyboard.down('j');
  await page.keyboard.down('j');
  await page.keyboard.up('j');
  await expect(page.locator(`${browser} [data-object-row]`)).toHaveCount(count);
  await page.keyboard.press('j');
  await expect(page.locator(`${browser} [data-object-row]`)).toHaveCount(count);
  await page.keyboard.press('j');
  await expect(page.locator(`${browser} [data-object-row]`)).toHaveCount(count + 24);
  await expect(page.locator(`${browser} [data-object-row]`).nth(count)).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(page.locator(selected)).toBeInViewport();
});

test('failed catalog preserves rows and retry; a stale request cannot select across tabs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/data/terminal/external.json', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await page.goto('/tools/?ui=tui#external');
  await page.locator(`${browser} [data-object-more]`).click();
  await expect(page.locator(`${browser} [data-object-error]`)).toBeVisible();
  await expect(page.locator(`${browser} [data-object-row]`)).toHaveCount(16);
  await page.unroute('**/data/terminal/external.json');
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/data/terminal/external.json', async (route) => {
    await wait;
    await route.continue();
  });
  await page.locator(`${browser} [data-object-retry]`).click();
  await expect(page.locator(`${browser} [data-object-status]`)).toHaveText('正在加载…');
  await page.locator('[data-tools-tab="services"]').click();
  release();
  await expect(page.locator('[data-tools-tab="services"]')).toHaveAttribute('aria-current', 'true');
  await page.locator('[data-tools-tab="external"]').click();
  await expect(page.locator(`${browser} [data-object-row]`)).toHaveCount(16);
  await page.locator(`${browser} [data-object-more]`).click();
  await expect(page.locator(`${browser} [data-object-row]`)).toHaveCount(40);
});

test('Tools shares query and sorting, and preserves a scroll anchor across mode and history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/tools/?ui=tui#external');
  await page.locator(query).fill('github');
  await page.locator(`${browser} [data-object-sort]`).selectOption('title');
  await expect(page).toHaveURL(/q=github/);
  expect(new URL(page.url()).searchParams.get('sort')).toBe('title');
  await page.reload();
  await expect(page.locator(query)).toHaveValue('github');
  await expect(page.locator(`${browser} [data-object-sort]`)).toHaveValue('title');
  await page.locator(query).fill('');
  await page.locator(query).press('Enter');
  await page.locator(`${browser} [data-object-more]`).click();
  await page.locator(`${browser} [data-object-row]`).nth(25).focus();
  const title = await page.locator(`${selected} strong`).innerText();
  await page.locator('[data-ui-mode-choice="gui"]').click();
  await expect(page.locator(`${selected} strong`)).toHaveText(title);
  const before = await page
    .locator(`${browser} [data-object-scroll]`)
    .evaluate((node) => node.scrollTop);
  await page.locator('[data-tools-tab="services"]').click();
  await page.goBack();
  await expect(page.locator(`${selected} strong`)).toHaveText(title);
  await expect
    .poll(() => page.locator(`${browser} [data-object-scroll]`).evaluate((node) => node.scrollTop))
    .toBeCloseTo(before, 0);
});

test('navigation reports its first target immediately and clears on page restoration', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?ui=tui');
  const observed: { text: string; contentVisible: boolean }[] = [];
  await page.exposeFunction(
    'recordNavigation',
    (state: { text: string; contentVisible: boolean }) => {
      observed.push(state);
    },
  );
  await page.evaluate(() => {
    document.addEventListener('keydown', () => {
      Reflect.get(
        window,
        'recordNavigation',
      )({
        text: document.querySelector('[data-command-message]')?.textContent ?? '',
        contentVisible: Boolean(document.querySelector('#terminal-main')?.getClientRects().length),
      });
    });
  });
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname.replace(/\/$/, '') === '/about',
    async (route) => {
      await wait;
      await route.continue();
    },
  );
  await page.keyboard.press('g');
  await page.keyboard.press('a');
  // Observe the key event before the pending MPA navigation replaces its execution context.
  await expect
    .poll(() => observed.some((state) => state.text === '前往 About…' && state.contentVisible))
    .toBe(true);
  await page.keyboard.press('g');
  await page.keyboard.press('p');
  expect(observed.some((state) => state.text.includes('Projects'))).toBe(false);
  release();
  await expect(page).toHaveURL(/\/about\/?\?ui=tui$/);
  await page.goBack();
  await expect(page.locator('[data-command-feedback]')).toBeHidden();
});

for (const mode of ['tui', 'gui']) {
  test(`${mode} homepage shares its brand and exposes public service introductions`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?ui=${mode}`);
    const home = page
      .locator(`[data-ui-only="${mode}"]`)
      .filter({ has: page.locator('[data-featured-system]') })
      .first();
    await expect(home.locator('[data-featured-system]').first().locator('p')).not.toBeEmpty();
    await expect(
      home.locator('[data-featured-system]').first().locator('a').first(),
    ).toHaveAttribute('href', /^\/infrastructure\//);
    const protectedEntry = home.locator('[data-private-link]').first();
    await expect(protectedEntry).toContainText('登录访问');
    await expect(page.locator('img[src="/images/biome-mark.svg"]')).toHaveCount(0);
    await expect(page.locator('img[src="/favicon.svg"]').first()).toHaveAttribute('alt', '');
    expect(
      await page
        .locator('#site-content')
        .evaluate((node) => getComputedStyle(node).viewTransitionName),
    ).toBe('none');
    await home.locator('[data-featured-system]').first().locator('a').first().click();
    await expect(page.locator('main')).not.toContainText('portal-pinned');
    await expect(page.locator('main')).toContainText('登记状态');
  });

  test(`${mode} resource controls and mobile dialogs fit supported viewport widths`, async ({
    page,
  }) => {
    await page.goto(`/tools/?ui=${mode}#external`);
    for (const [width, height] of [
      [1366, 768],
      [1600, 1000],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      await expect(page.locator(query)).toBeInViewport();
      await expect(page.locator('[data-tools-tabs]')).toBeInViewport();
      expect(
        await page
          .locator(`${browser} [data-object-scroll]`)
          .evaluate((node) => getComputedStyle(node).overflowY),
      ).toBe('auto');
      expect(await page.locator('#site-content').evaluate((node) => node.scrollTop)).toBe(0);
    }
    await page.screenshot({ path: `.artifacts/resource-interactions/desktop-${mode}.png` });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect((await page.locator(query).boundingBox())?.width).toBeGreaterThanOrEqual(128);
      await expect(page.locator('[data-terminal-dock] nav a').last()).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.locator(`${browser} [data-object-row] strong`).first().click();
      const detail = page.locator('[data-object-detail][open]');
      await expect(detail).toBeVisible();
      expect(await detail.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      await detail.getByRole('button', { name: '关闭详情' }).click();
      await page.getByRole('button', { name: '键盘帮助', exact: true }).click();
      const help = page.locator('#terminal-help');
      await expect(help).toBeVisible();
      expect(await help.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      await page.getByRole('button', { name: '关闭帮助' }).click();
    }
    await page.screenshot({ path: `.artifacts/resource-interactions/mobile-${mode}.png` });
  });
}
