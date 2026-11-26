import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { parseDashboardBody } from '../src/domain/site-pages/dashboard';
import { parsePublishedSitePage } from './site-page-frontmatter';

const sourcePath = path.resolve('src/data/obsidian/pages/dashboard.md');
const source = fs.existsSync(sourcePath)
  ? parsePublishedSitePage(fs.readFileSync(sourcePath, 'utf8'), sourcePath)
  : undefined;

test('Dashboard is a public Slash Page with links ordered by the authored Markdown', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?ui=gui');
  await page
    .locator('section[data-ui-only="gui"] [data-home-slash-links] a[href^="/dashboard"]')
    .click();
  await expect(page).toHaveURL(/\/dashboard\/?(?:\?ui=gui)?$/);
  const article = page.locator('[data-authored-page="dashboard"]');
  await expect(article).toBeVisible();
  if (!source) {
    // The previous immutable producer publication predates Dashboard.
    await expect(article.locator('[data-authored-page-empty]')).toBeVisible();
    return;
  }
  const groups = parseDashboardBody(source.body);
  await expect(article.getByRole('heading', { name: source.title, exact: true })).toBeVisible();
  const renderedGroups = article.locator('[data-dashboard-group]');
  await expect(renderedGroups).toHaveCount(groups.length);
  for (const [index, group] of groups.entries()) {
    const rendered = renderedGroups.nth(index);
    await expect(rendered.getByRole('heading', { name: group.title, exact: true })).toBeVisible();
    const links = rendered.locator('[data-dashboard-link] > a[target="_blank"]');
    await expect(links).toHaveCount(group.links.length);
    for (const [position, link] of group.links.entries()) {
      await expect(links.nth(position)).toHaveAttribute('href', link.href);
      await expect(links.nth(position)).toContainText(link.title);
    }
  }
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(390);
});
