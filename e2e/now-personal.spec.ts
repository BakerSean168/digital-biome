import { expect, test } from '@playwright/test';
import { NOW_ENTRIES, NOW_UPDATED_AT } from '../src/config/now-profile';

test('Now displays editable peer entries instead of fixed focus/game/media sections', async ({
  page,
}) => {
  await page.goto('/now/?ui=gui');
  const now = page.locator('article[data-ui-only="gui"]');

  await expect(now.getByRole('heading', { name: '最近在做什么' })).toBeVisible();
  await expect(now.locator(`time[datetime="${NOW_UPDATED_AT}"]`)).toBeVisible();
  await expect(now.locator('[data-now-item]')).toHaveCount(NOW_ENTRIES.length);
  for (const kind of new Set(NOW_ENTRIES.map((entry) => entry.kind))) {
    await expect(now.locator(`[data-now-kind="${kind}"]`)).toHaveCount(
      NOW_ENTRIES.filter((entry) => entry.kind === kind).length,
    );
  }
  for (const entry of NOW_ENTRIES) {
    const card = now.locator(`[data-now-item="${entry.id}"]`);
    await expect(card).toContainText(entry.title);
    await expect(card).toContainText(entry.category);
  }
  await expect(now.locator('a')).toHaveCount(0);
  await expect(page.locator('[data-terminal-dock] a[href^="/now"]')).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('Now keeps the same standalone items across phone GUI/TUI modes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/now/?ui=gui');

  const widths = await page.evaluate(() => ({
    document: document.body.scrollWidth,
    content: document.getElementById('site-content')?.scrollWidth ?? Infinity,
    viewport: innerWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);

  await page.locator('[data-ui-mode-choice="tui"]').click();
  const now = page.locator('article[data-ui-only="tui"]');
  await expect(now.locator('[data-now-item]')).toHaveCount(NOW_ENTRIES.length);
  await expect(now).toContainText('矮人要塞');
  await expect(now).toContainText('绝命毒师');
  await expect(now.locator('a')).toHaveCount(0);
  await expect(now.locator(`time[datetime="${NOW_UPDATED_AT}"]`)).toBeVisible();
});

test('Now is a peer in the six-item dock and Projects has a canonical root', async ({ page }) => {
  await page.goto('/now/?ui=gui');
  const nav = page.getByRole('navigation', { name: '主导航' });
  await expect(nav.locator('a')).toHaveCount(6);
  await expect(nav.locator('a[href^="/now"]')).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('a[href^="/about"]')).not.toHaveAttribute('aria-current', 'page');

  await nav.locator('a[href^="/projects"]').click();
  await expect(page).toHaveURL(/\/projects\/?(?:\?ui=gui)?$/);
  await expect(page.getByRole('navigation', { name: '项目类别' })).toBeVisible();
  await page.goto('/dev/');
  await expect(page).toHaveURL(/\/projects\/?$/);
});

test('Six peer nav links fit in a phone viewport without wrapping or overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/now/?ui=gui');
  const dock = page.getByRole('navigation', { name: '主导航' });
  await expect(dock.locator('a')).toHaveCount(6);
  const bounds = await dock.evaluate((nav) => {
    const links = [...nav.querySelectorAll('a')];
    return {
      scroll: nav.scrollWidth,
      available: nav.clientWidth,
      yFirst: links[0]?.getBoundingClientRect().top,
      yLast: links[links.length - 1]?.getBoundingClientRect().top,
      page: document.body.scrollWidth,
      viewport: innerWidth,
    };
  });
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.available);
  expect(bounds.yFirst).toBe(bounds.yLast);
  expect(bounds.page).toBeLessThanOrEqual(bounds.viewport);
});
