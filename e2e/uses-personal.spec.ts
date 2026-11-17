import { expect, test } from '@playwright/test';

test('Uses is one integrated hardware, software and resource directory', async ({ page }) => {
  await page.goto('/uses/?ui=gui');
  await expect(page.getByRole('heading', { name: /我正在使用的东西/ })).toBeVisible();
  await expect(
    page.locator('header[data-ui-only="gui"] time[datetime="2026-11-17"]'),
  ).toBeVisible();
  await expect(page.locator('[data-uses-tab]')).toHaveCount(6);
  await expect(page.locator('[data-uses-tab="hardware"]')).toHaveAttribute('aria-current', 'true');
  await expect(
    page.locator('[data-uses-panel]:not([hidden]) [data-uses-hardware-item]'),
  ).toHaveCount(7);
  await expect(page.locator('#hardware')).toContainText('N100');
  await expect(page.locator('#hardware')).toContainText('ATK F1 V3');

  await page.locator('[data-uses-tab="software"]').click();
  await expect(page.locator('[data-uses-tab="software"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#software [data-uses-software-group]')).toHaveCount(3);
  await expect(page.locator('#software')).toContainText('Neovim / AstroNvim');
  await expect(page.locator('#hardware')).toBeHidden();

  await page.locator('[data-uses-tab="services"]').click();
  await expect(page.locator('[data-object-browser]:visible')).toHaveCount(1);
  await expect(page.locator('[data-uses-tab="services"]')).toHaveAttribute('aria-current', 'true');
  await expect(page).toHaveURL(/\/uses\/?(?:\?ui=gui)?#services$/);

  await page.locator('[data-uses-tab="external"]').click();
  await expect(page.locator('[data-uses-tab="external"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-object-browser]:visible [data-object-row]')).toHaveCount(16);
  await expect(page.locator('#external')).toContainText('ChatGPT');
});

test('Uses owns the only published resource route and details', async ({ page, request }) => {
  await page.goto('/?ui=tui');
  const usesLink = page.locator('[data-terminal-dock] a[href^="/uses"]');
  await expect(usesLink).toBeVisible();
  await usesLink.click();
  await expect(page.locator('[data-uses-tab="hardware"]')).toHaveAttribute('aria-current', 'true');

  await page.locator('[data-uses-tab="hosts"]').click();
  await expect(page.locator('#hosts [data-object-browser]')).toBeVisible();
  await page.locator('[data-uses-tab="network"]').click();
  await expect(page.locator('#network [data-object-browser]')).toBeVisible();

  const retired = await request.get('/tools/');
  expect(retired.status()).toBe(404);
  const retiredCatalog = await request.get('/data/tools-catalog.json');
  expect(retiredCatalog.status()).toBe(404);
  const usesCatalog = await request.get('/data/uses-catalog.json');
  expect(usesCatalog.ok()).toBe(true);
});

test('Uses fits a phone screen and keeps resource tabs working after GUI/TUI changes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/uses/?ui=gui#software');

  const width = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    content: document.getElementById('site-content')?.scrollWidth ?? Infinity,
    viewport: innerWidth,
  }));
  expect(width.body).toBeLessThanOrEqual(width.viewport);
  expect(width.content).toBeLessThanOrEqual(width.viewport);
  await expect(page.locator('#software')).toContainText('Obsidian');

  await page.locator('[data-ui-mode-choice="tui"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'tui');
  await expect(page.locator('[data-uses-tab="software"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#software')).toContainText('Docker Compose');

  await page.locator('[data-uses-tab="external"]').click();
  await expect(page.locator('#external [data-object-browser]')).toBeVisible();
});
