import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { parseDashboardBody } from '../src/domain/site-pages/dashboard';
import { parsePublishedSitePage } from './site-page-frontmatter';

const sourcePath = path.resolve('src/data/obsidian/pages/dashboard.md');
const source = fs.existsSync(sourcePath)
  ? parsePublishedSitePage(fs.readFileSync(sourcePath, 'utf8'), sourcePath)
  : undefined;

test('Dashboard is Uses tab 7 with links ordered by the authored Markdown', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?ui=gui');
  const home = page.locator('section[data-ui-only="gui"] [data-home-slash-links]');
  await expect(home.locator('a[href^="/dashboard"]')).toHaveCount(0);
  await home.locator('a[href^="/uses"]').click();
  await expect(page.locator('[data-uses-tab]')).toHaveCount(7);
  const dashboardTab = page.locator('[data-uses-tab="dashboard"]');
  await expect(dashboardTab).toHaveAttribute('data-terminal-tab', '7');
  await expect(page.locator('html')).toHaveAttribute('data-shortcuts', 'on');
  await page.keyboard.press('7');
  await expect(page).toHaveURL(/\/uses\/?(?:\?ui=gui)?#dashboard$/);
  await expect(dashboardTab).toHaveAttribute('aria-current', 'true');
  await expect(dashboardTab).toBeInViewport();
  await expect(page.locator('#hardware')).toBeHidden();
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

test('Dashboard filtering, keyboard focus, and group opening work without global shortcut conflicts', async ({
  page,
  context,
}) => {
  if (!source) {
    test.skip(true, 'The locked producer snapshot predates the Dashboard content');
    return;
  }
  const groups = parseDashboardBody(source.body);
  const group = groups.find((item) => item.level === 3 && item.links.length >= 2);
  if (!group) {
    test.skip(true, 'A multi-link group is required');
    return;
  }
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/uses/?ui=gui#dashboard');
  const root = page.locator('[data-authored-page="dashboard"]');
  const search = root.getByRole('searchbox', { name: '搜索网站' });
  const visible = root.locator('[data-dashboard-target]:visible');
  const section = root.locator('[data-dashboard-group]').filter({
    has: page.getByRole('heading', { name: group.title, exact: true }),
  });
  await page.keyboard.press('/');
  await expect(search).toBeFocused();
  await expect(page.locator('#search-modal')).not.toBeVisible();
  await search.fill(group.title);
  await expect(section.locator('[data-dashboard-target]:visible')).toHaveCount(group.links.length);
  await search.press('Enter');
  await expect(visible.first()).toBeFocused();
  await page.keyboard.press('l');
  await expect(visible.nth(1)).toBeFocused();
  await page.keyboard.press('h');
  await expect(visible.first()).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(visible.nth(1)).toBeFocused();
  // Actual navigation uses the native external anchor, in a new tab.
  await context.route('**/*', async (route) => {
    if (route.request().isNavigationRequest() && route.request().url() === group.links[1].href) {
      await route.fulfill({ body: 'dashboard test destination' });
    } else {
      await route.continue();
    }
  });
  const popup = page.waitForEvent('popup');
  await page.keyboard.press('Enter');
  const tab = await popup;
  await tab.waitForLoadState();
  await expect(tab).toHaveURL(group.links[1].href);
  await tab.close();
  await page.bringToFront();
  await page.keyboard.press('Escape');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue(group.title);
  await search.fill(group.links[0].title);
  // Group action still requests every direct link, not only the filtered ones.
  await page.evaluate(() => {
    const requests: string[] = [];
    Object.defineProperty(window, '__dashboardOpenRequests', { value: requests });
    window.open = (url) => {
      requests.push(String(url));
      return null;
    };
  });
  await section.getByRole('button', { name: /本组全部网站/ }).click();
  const requests = await page.evaluate(
    () => (window as Window & { __dashboardOpenRequests?: string[] }).__dashboardOpenRequests,
  );
  expect(requests).toEqual(group.links.map((link) => link.href));
  await expect(root.getByRole('status')).toContainText('已请求打开');
  await search.fill('no-dashboard-match-7e9db');
  await expect(visible).toHaveCount(0);
  await expect(root.locator('[data-dashboard-empty]')).toBeVisible();
  await search.press('Enter');
  await expect(search).toBeFocused();
  await search.press('Escape');
  await expect(visible).toHaveCount(groups.reduce((sum, item) => sum + item.links.length, 0));
});

test('Dashboard navigation follows the responsive grid and ignores IME composition', async ({
  page,
}) => {
  test.skip(!source, 'The locked producer snapshot predates the Dashboard content');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/uses/?ui=tui#dashboard');
  const root = page.locator('[data-authored-page="dashboard"]');
  const search = root.getByRole('searchbox');
  const links = root.locator('[data-dashboard-target]:visible');
  await search.focus();
  await search.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
  await expect(search).toBeFocused();
  await search.press('Enter');
  await expect(links.first()).toBeFocused();
  await page.keyboard.press('j');
  await expect(links.nth(1)).toBeFocused();
  await page.keyboard.press('k');
  await expect(links.first()).toBeFocused();
  await page.keyboard.press('k');
  await expect(search).toBeFocused();
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(390);
});

test('Uses tab 7 integrates with keyboard commands, browser history and global search', async ({
  page,
  request,
}) => {
  await page.goto('/?ui=tui');
  await page.keyboard.press('g');
  await page.keyboard.press('u');
  await expect(page).toHaveURL(/\/uses\/?\?ui=tui$/);
  await expect(page.locator('[data-uses-tab="hardware"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-shortcuts', 'on');
  await page.keyboard.press('7');
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('[data-uses-dashboard-hints]')).not.toHaveAttribute('hidden', '');
  await expect(page.locator('[data-terminal-path]')).toHaveText('~/uses#dashboard');
  await page.keyboard.press('4');
  await expect(page.locator('#external')).toBeVisible();
  await expect(page.locator('#dashboard')).toBeHidden();
  await page.keyboard.press('/');
  await expect(page.locator('#search-modal')).toBeVisible();
  await page.locator('#cmd-input').fill('/dashboard');
  await page.getByRole('option').filter({ hasText: 'Uses / Dashboard' }).click();
  await expect(page).toHaveURL(/\/uses\/?\?ui=tui#dashboard$/);
  await expect(page.locator('#search-modal')).not.toBeVisible();
  await expect(page.locator('#dashboard')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#external')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#dashboard')).toBeVisible();
  expect((await request.get('/dashboard/')).status()).toBe(404);
});

test('Dashboard scrolls within the Uses workspace on desktop', async ({ page }) => {
  test.skip(!source, 'The locked producer snapshot predates the Dashboard content');
  await page.setViewportSize({ width: 1200, height: 600 });
  await page.goto('/uses/?ui=tui#dashboard');
  const scroll = page.locator('#dashboard [data-uses-scroll]');
  const tabs = page.locator('[data-uses-tabs]');
  const y = (await tabs.boundingBox())?.y;
  expect(await scroll.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  );
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.locator('[data-dashboard-search]')).toBeInViewport();
  expect((await tabs.boundingBox())?.y).toBe(y);
  expect(await page.locator('#site-content').evaluate((element) => element.scrollTop)).toBe(0);
});
