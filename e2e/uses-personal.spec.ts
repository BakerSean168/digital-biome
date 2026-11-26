import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { selectResourceEntries } from '../src/domain/resource-collections';
import type { NoteIndexEntry } from '../src/types/knowledge-index';

const entries: NoteIndexEntry[] = JSON.parse(
  fs.readFileSync('src/data/indexes/notes-index.json', 'utf8'),
).entries;
const expectedSoftwareCount = selectResourceEntries(entries, 'uses').filter((entry) =>
  entry.filePath.startsWith('uses/software/'),
).length;
const expectedWebsiteCount = selectResourceEntries(entries, 'bookmarks').length;
const expectedHardwareCount = JSON.parse(
  fs.readFileSync('src/data/indexes/uses-summaries.json', 'utf8'),
).length;

test('Uses opens with seven compact tabs and consistent selectable list browsers', async ({
  page,
}) => {
  await page.goto('/uses/?ui=gui');

  await expect(page.getByRole('navigation', { name: 'Uses 分类' })).toBeVisible();
  await expect(page.locator('[data-uses-tab]')).toHaveCount(7);
  await expect(page.locator('main [data-ui-only="gui"] header')).toHaveCount(0);
  await expect(page.locator('[data-uses-tab="hardware"]')).toHaveAttribute('aria-current', 'true');

  const hardware = page.locator('#hardware [data-object-browser]');
  expect(expectedHardwareCount).toBeGreaterThan(0);
  await expect(hardware.locator('[data-object-row]')).toHaveCount(expectedHardwareCount);
  await expect(hardware).toContainText('Intel N100');
  await expect(hardware.locator('[data-object-preview]')).toContainText('Acer SH16-74');
  await expect(hardware.locator('[data-object-open]')).toHaveCount(0);
  await expect(hardware.locator('[data-object-direct]:visible')).toHaveCount(0);

  await hardware.locator('[data-object-filter]').fill('N100');
  await expect(hardware.locator('[data-object-row]')).toHaveCount(1);
  await expect(hardware.locator('[data-object-preview]')).toContainText('N100');
  await hardware.locator('[data-object-filter]').fill('');

  await page.locator('[data-uses-tab="software"]').click();
  const software = page.locator('#software [data-object-browser]');
  await expect(page.locator('#hardware')).toBeHidden();
  expect(expectedSoftwareCount).toBeGreaterThan(0);
  await expect(software.locator('[data-object-row]')).toHaveCount(expectedSoftwareCount);
  await expect(software).toContainText('Neovim / AstroNvim');
  await expect(software.locator('[data-object-preview]')).toContainText('Windows 11 + WSL');
  await software.locator('[data-object-filter]').fill('Obsidian');
  await expect(software.locator('[data-object-row]')).toHaveCount(1);

  await page.locator('[data-uses-tab="services"]').click();
  await expect(page.locator('#services [data-object-browser]')).toBeVisible();
  await page.locator('[data-uses-tab="external"]').click();
  expect(expectedWebsiteCount).toBeGreaterThan(0);
  await expect(page.locator('#external [data-object-browser] [data-object-row]')).toHaveCount(
    Math.min(16, expectedWebsiteCount),
  );
});

test('Uses remains the only resource catalog route and retains its category data endpoints', async ({
  page,
  request,
}) => {
  await page.goto('/uses/?ui=tui#hosts');
  await expect(page.locator('[data-uses-tab="hosts"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#hosts [data-object-browser]')).toBeVisible();
  await page.locator('[data-uses-tab="network"]').click();
  await expect(page.locator('#network [data-object-browser]')).toBeVisible();

  expect((await request.get('/tools/')).status()).toBe(404);
  expect((await request.get('/data/tools-catalog.json')).status()).toBe(404);
  expect((await request.get('/data/uses-catalog.json')).ok()).toBe(true);
});

test('Uses mobile tabs, search and hardware preview fit without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/uses/?ui=gui#hardware');

  const width = await page.evaluate(() => ({
    document: document.body.scrollWidth,
    content: document.getElementById('site-content')?.scrollWidth ?? Infinity,
    viewport: window.innerWidth,
  }));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
  expect(width.content).toBeLessThanOrEqual(width.viewport);

  const hardware = page.locator('#hardware [data-object-browser]');
  await hardware.locator('[data-object-row]').first().click();
  await expect(page.locator('[data-object-detail][open]')).toContainText('Acer SH16-74');
  await page.getByRole('button', { name: '关闭详情' }).click();

  await page.locator('[data-ui-mode-choice="tui"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'tui');
  await expect(page.locator('[data-uses-tab="hardware"]')).toHaveAttribute('aria-current', 'true');
  await page.locator('[data-uses-tab="software"]').click();
  await expect(page.locator('#software [data-object-browser]')).toBeVisible();
  await expect(page.locator('#software')).toContainText('Obsidian');
});
