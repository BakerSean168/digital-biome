import { expect, test } from '@playwright/test';
import { NOW_ENTRIES, NOW_UPDATED_AT } from '../src/config/now-profile';
import { publishedBlogHref } from './published-blog-href';

const linkedProjects = NOW_ENTRIES.filter(
  (entry) => entry.blogSlug && publishedBlogHref(entry.blogSlug),
);

test('Now shows a shared page banner above its compact icon list', async ({ page }) => {
  await page.goto('/now/?ui=gui');
  const now = page.locator('article[data-ui-only="gui"]');

  await expect(now.getByRole('heading', { name: '最近在做什么', exact: true })).toBeVisible();
  await expect(now.locator('header')).toContainText('/ NOW');
  await expect(now.locator('header time')).toHaveAttribute('datetime', NOW_UPDATED_AT);
  await expect(now.locator('[data-now-item]')).toHaveCount(NOW_ENTRIES.length);
  await expect(now.locator('li[data-now-item]')).toHaveCount(NOW_ENTRIES.length);
  await expect(now.locator('time')).toHaveCount(1);
  await expect(now.locator('a')).toHaveCount(linkedProjects.length);
  for (const entry of linkedProjects) {
    const link = now.getByRole('link', { name: entry.title, exact: true });
    await expect(link).toHaveAttribute('href', /^\/notes\/obsidian\/blogs\//);
    const target = new URL((await link.getAttribute('href')) ?? '', page.url());
    expect(target.pathname).toBe(publishedBlogHref(entry.blogSlug ?? ''));
  }
  await expect(now).not.toContainText('BUILDING');
  await expect(now).not.toContainText('PLAYING');
  await expect(now).not.toContainText('PERSONAL PROJECT');
  await expect(now).not.toContainText('MOBA');
  await expect(now).not.toContainText('阿里三');

  for (const entry of NOW_ENTRIES) {
    const row = now.locator(`[data-now-item="${entry.id}"]`);
    await expect(row).toContainText(entry.title);
    await expect(row).toContainText(entry.description);
    if (entry.secondaryName) await expect(row).toContainText(entry.secondaryName);
    await expect(row.locator('span[role="img"] svg')).toHaveCount(1);
    await expect(row.locator('span[role="img"]')).toHaveAttribute(
      'aria-label',
      entry.kind === 'project' ? '正在开发' : entry.kind === 'game' ? '正在玩' : '正在看',
    );
    await expect(row.locator('h2')).toHaveCount(1);
    await expect(row.locator('p')).toHaveCount(1);
  }
  await expect(now.locator('[data-now-item="bodysense"]')).toContainText('BodySense');
  await expect(page.locator('[data-terminal-dock] a[href^="/now"]')).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('Now stays compact in both modes on a phone, without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/now/?ui=gui');

  const width = await page.evaluate(() => ({
    document: document.body.scrollWidth,
    content: document.getElementById('site-content')?.scrollWidth ?? Infinity,
    viewport: innerWidth,
  }));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
  expect(width.content).toBeLessThanOrEqual(width.viewport);

  await page.locator('[data-ui-mode-choice="tui"]').click();
  const now = page.locator('article[data-ui-only="tui"]');
  await expect(now.locator('h1')).toHaveText('最近在做什么');
  await expect(now.locator('header time')).toHaveAttribute('datetime', NOW_UPDATED_AT);
  await expect(now.locator('[data-now-item]')).toHaveCount(NOW_ENTRIES.length);
  await expect(now).toContainText('BodySense');
  await expect(now).toContainText('矮人要塞');
  await expect(now).toContainText('绝命毒师');
  await expect(now.locator('a')).toHaveCount(linkedProjects.length);
  await expect(now.locator('time')).toHaveCount(1);
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
