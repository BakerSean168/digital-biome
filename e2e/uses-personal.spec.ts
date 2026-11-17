import { expect, test } from '@playwright/test';

test('Uses describes actual hardware and software and exposes only published website links', async ({
  page,
}) => {
  await page.goto('/uses/?ui=gui');

  const uses = page.locator('article[data-ui-only="gui"]');
  await expect(uses.getByRole('heading', { name: /我正在使用的/ })).toBeVisible();
  await expect(uses.locator('time[datetime="2026-11-17"]')).toBeVisible();
  await expect(uses.locator('[data-uses-section]')).toHaveCount(4);
  await expect(uses.locator('[data-uses-hardware-item]')).toHaveCount(7);
  await expect(uses.locator('[data-uses-software-group]')).toHaveCount(3);
  await expect(uses).toContainText('Intel N100');
  await expect(uses).toContainText('ATK F1 V3');
  await expect(uses).toContainText('Neovim / AstroNvim');
  await expect(uses.locator('[data-uses-website]')).toHaveCount(4);
  await expect(uses.locator('a[href$="#services"]')).toBeVisible();
  await expect(uses.locator('a[href$="#external"]')).toBeVisible();
  await expect(uses).not.toContainText('期望薪资');

  for (const href of await uses
    .locator('[data-uses-service] a')
    .evaluateAll((links) =>
      links.map((element) => (element as HTMLAnchorElement).getAttribute('href')),
    )) {
    expect(href).toMatch(/^\/infrastructure\/[\w-]+$/);
  }
  for (const site of await uses.locator('[data-uses-website] a').all()) {
    const href = await site.getAttribute('href');
    expect(href).toMatch(/^https?:\/\//);
    await expect(site).toHaveAttribute('rel', /noopener/);
  }
});

test('Uses is the primary navigation destination while legacy Tools remains a functional catalog', async ({
  page,
}) => {
  await page.goto('/?ui=tui');
  const usesLink = page.locator('[data-terminal-dock] a[href^="/uses"]');
  await expect(usesLink).toBeVisible();
  await usesLink.click();
  await expect(page).toHaveURL(/\/uses\/?(?:\?ui=tui)?$/);
  await expect(page.locator('article[data-ui-only="tui"]')).toContainText(
    'SteelSeries Arctis Nova 5',
  );

  await page.locator('article[data-ui-only="tui"] a[href$="#external"]').first().click();
  await expect(page).toHaveURL(/\/tools(?:\/?\?ui=tui)?#external$/);
  await expect(page.locator('[data-tools-tab="external"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-terminal-dock] a[href^="/uses"]')).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('Uses stays readable on a phone and keeps software and hardware in TUI', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/uses/?ui=gui');

  const width = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
    content: document.getElementById('site-content')?.scrollWidth ?? Infinity,
  }));
  expect(width.body).toBeLessThanOrEqual(width.viewport);
  expect(width.content).toBeLessThanOrEqual(width.viewport);

  await page.locator('[data-ui-mode-choice="tui"]').click();
  const tui = page.locator('article[data-ui-only="tui"]');
  await expect(tui).toContainText('N100');
  await expect(tui).toContainText('Obsidian');
  await expect(tui).toContainText('Services');
  await expect(tui).toContainText('Websites');
});
