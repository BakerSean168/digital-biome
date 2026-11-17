import { expect, test } from '@playwright/test';

test('Now presents a dated snapshot of activities, games and media', async ({ page }) => {
  await page.goto('/now/?ui=gui');
  const now = page.locator('article[data-ui-only="gui"]');

  await expect(now.getByRole('heading', { name: /这段时间/ })).toBeVisible();
  await expect(now.locator('time[datetime="2026-11-17"]')).toBeVisible();
  await expect(now.locator('[data-now-section="focus"] article')).toHaveCount(3);
  await expect(now.locator('[data-now-section="games"] li')).toHaveCount(4);
  await expect(now.locator('[data-now-section="media"] article')).toHaveCount(2);
  await expect(now).toContainText('PUBG');
  await expect(now).toContainText('绝命毒师');
  await expect(now).toContainText('寒蝉鸣泣之时');
  await expect(now).not.toContainText('期望薪资');
  await expect(page.locator('[data-terminal-dock] a[href^="/now"]')).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('Now remains readable on mobile and navigates back to About', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/now/?ui=gui');
  const aboutLink = page.locator('article[data-ui-only="gui"] a[href^="/about"]').first();

  await expect(aboutLink).toBeVisible();
  const widths = await page.evaluate(() => ({
    document: document.body.scrollWidth,
    content: document.getElementById('site-content')?.scrollWidth ?? Infinity,
    viewport: innerWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);

  await page.locator('[data-ui-mode-choice="tui"]').click();
  await expect(page.locator('article[data-ui-only="tui"]')).toContainText('矮人要塞');
  await expect(
    page.locator('article[data-ui-only="tui"] time[datetime="2026-11-17"]'),
  ).toBeVisible();
  await page.locator('article[data-ui-only="tui"] a[href^="/about"]').first().click();
  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'tui');
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
