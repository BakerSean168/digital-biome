import { expect, test } from '@playwright/test';

const OTHER_SLUGS = [
  'ai',
  'ideas',
  'canon',
  'colophon',
  'friends',
  'blogroll',
  'carry',
  'defaults',
];

test('Home indexes specific Slash Pages and opens the matching Other tab', async ({ page }) => {
  await page.goto('/?ui=gui');
  const home = page.locator('section[data-ui-only="gui"] [data-home-slash-links]');
  await expect(home.locator('a')).toHaveCount(15);
  await expect(home.locator('a[href="/other"]')).toHaveCount(0);

  for (const [index, slug] of OTHER_SLUGS.entries()) {
    const link = home.locator('a[href$="#' + slug + '"]');
    await expect(link).toContainText('/' + slug);
    await expect(link.locator('kbd')).toHaveText(`g o ${index + 1}`);
  }
  await expect(home.locator('a[href^="/blog"] kbd')).toHaveText('g l 1');
  await expect(home.locator('a[href^="/notes"] kbd')).toHaveText('g l 2');

  await home.locator('a[href$="#ai"]').click();
  await expect(page).toHaveURL(/\/other\/?\?ui=gui#ai$/);
  await expect(page.locator('[data-other-tab]')).toHaveCount(8);
  await expect(page.locator('#ai[data-other-panel]')).toBeVisible();
  await expect(page.locator('#ai [data-authored-page="ai"]')).toBeVisible();
  await expect(page.locator('#ideas')).toBeHidden();
  await page.locator('[data-other-tab="friends"]').click();
  await expect(page.locator('#friends')).toContainText('Aleksiz');
  await expect(page.locator('#friends [data-object-row][href="https://aleksiz.com/"]')).toHaveCount(
    1,
  );

  await page.locator('[data-other-tab="ideas"]').click();
  await expect(page).toHaveURL(/\/other\/?\?ui=gui#ideas$/);
  await expect(page.locator('#ideas')).toBeVisible();
  await expect(page.locator('#ai')).toBeHidden();
  await page.goBack();
  await expect(page.locator('#friends')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#ai')).toBeVisible();
});

test('g o changes the page, then number 3 changes only the current tab', async ({ page }) => {
  await page.goto('/about/?ui=tui');
  await page.keyboard.press('g');
  await page.keyboard.press('o');
  await expect(page).toHaveURL(/\/other\/?\?ui=tui$/);
  await expect(page.locator('#ai')).toBeVisible();
  // A full-page navigation may finish before its keyboard handler is hydrated.
  await expect(page.locator('html')).toHaveAttribute('data-shortcuts', 'on');

  await page.keyboard.press('3');
  await expect(page).toHaveURL(/\/other\/?\?ui=tui#canon$/);
  await expect(page.locator('#canon')).toBeVisible();
  await expect(page.locator('[data-other-tab="canon"]')).toHaveAttribute('aria-current', 'true');

  await page.keyboard.press('7');
  await expect(page.locator('#carry [data-object-browser]')).toBeVisible();
  await expect(page).toHaveURL(/\/other\/?\?ui=tui#carry$/);
  await page.keyboard.press('4');
  await expect(page.locator('#colophon')).toBeVisible();
});

test('Other tabs fit mobile and original individual routes still resolve', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/other/?ui=gui#defaults');
  await expect(page.locator('#defaults [data-object-browser]')).toBeVisible();
  // Native scrollWidth rounds to whole pixels; allow subpixel edge clipping.
  await expect(page.locator('[data-other-tab="defaults"]')).toBeInViewport({ ratio: 0.99 });
  const layout = await page.evaluate(() => ({
    documentWidth: document.body.scrollWidth,
    contentWidth: document.getElementById('site-content')?.scrollWidth ?? Infinity,
    viewport: innerWidth,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.contentWidth).toBeLessThanOrEqual(layout.viewport);
  for (const slug of ['ai', 'ideas', 'canon', 'colophon']) {
    const response = await request.get('/' + slug + '/');
    expect(response.status()).toBe(200);
  }
});

test('explicit Other tab selection clears filters while history restores prior filters', async ({
  page,
}) => {
  await page.goto('/other/?ui=gui&q=unmatched-query&sort=title&facet=unused#carry');
  await expect(page.locator('#carry')).toBeVisible();
  await expect(page.locator('#carry [data-object-filter]')).toHaveValue('unmatched-query');
  await expect(page.locator('html')).toHaveAttribute('data-shortcuts', 'on');
  await page.locator('[data-other-tab="defaults"]').click();
  await expect(page.locator('#defaults')).toBeVisible();
  await expect(page.locator('#defaults [data-object-filter]')).toHaveValue('');
  await expect(page).not.toHaveURL(/[?&](q|sort|facet)=/);
  await page.goBack();
  await expect(page.locator('#carry')).toBeVisible();
  await expect(page).toHaveURL(/[?&]q=unmatched-query/);
  await expect(page.locator('#carry [data-object-filter]')).toHaveValue('unmatched-query');
  await page.locator('[data-other-tab="carry"]').click();
  await expect(page.locator('#carry [data-object-filter]')).toHaveValue('');
  await expect(page.locator('#carry')).toBeVisible();
  await expect(page).not.toHaveURL(/[?&](q|sort|facet)=/);
});

test('skip to content preserves the selected Other tab', async ({ page }) => {
  await page.goto('/other/?ui=gui#friends');
  await expect(page.locator('#friends')).toBeVisible();
  const skip = page.getByRole('link', { name: '跳到内容', exact: true });
  await skip.focus();
  await skip.press('Enter');
  await expect(page.locator('#terminal-main')).toBeFocused();
  await expect(page.locator('#friends')).toBeVisible();
  await expect(page).toHaveURL(/#friends$/);
});
