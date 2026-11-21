import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { parseUsesSummaries } from '../src/domain/uses-summary';
import { selectResourceEntries } from '../src/domain/resource-collections';
import type { NoteIndexEntry } from '../src/types/knowledge-index';

const entries: NoteIndexEntry[] = JSON.parse(
  fs.readFileSync('src/data/indexes/notes-index.json', 'utf8'),
).entries;
const summaries = parseUsesSummaries(
  JSON.parse(fs.readFileSync('src/data/indexes/uses-summaries.json', 'utf8')),
);

test('Uses Websites retains public bookmarked resources without a duplicate Bookmarks page', async ({
  page,
  request,
}) => {
  const expected = selectResourceEntries(entries, 'bookmarks');
  const external = await request.get('/data/terminal/external.json');
  expect(external.ok()).toBe(true);
  const publishedIds = (await external.json()).map((row: { id: string }) => row.id);
  for (const record of expected) {
    expect(publishedIds).toContain(record.asset_id ?? record.id);
  }
  expect((await request.get('/bookmarks/')).status()).toBe(404);
  expect((await request.get('/data/terminal/bookmarks.json')).status()).toBe(404);
  await page.goto('/uses/?ui=gui#external');
  const browser = page.locator('#external [data-object-browser]');
  await expect(browser).toBeVisible();
  await expect(browser.locator('[data-object-row]').first()).toBeVisible();
});

for (const name of ['blogroll', 'carry', 'defaults'] as const) {
  test(`${name} renders exactly the public authored selection and its empty state`, async ({
    page,
    request,
  }) => {
    const expected = selectResourceEntries(entries, name);
    const response = await request.get(`/data/terminal/${name}.json`);
    expect(response.ok()).toBe(true);
    expect((await response.json()).map((row: { id: string }) => row.id)).toEqual(
      expected.map((row) => row.asset_id ?? row.id),
    );
    await page.goto(`/${name}/?ui=gui`);
    if (!expected.length) {
      const messages = {
        blogroll: '个人博客',
        carry: '随身携带',
        defaults: '默认使用',
      };
      await expect(page.locator('[data-object-empty]')).toBeVisible();
      await expect(page.locator('[data-object-empty]')).toContainText(messages[name]);
    } else await expect(page.locator('[data-object-row]').first()).toBeVisible();
  });
}

for (const name of ['colophon', 'ai', 'ideas', 'canon']) {
  test(`${name} renders public Markdown or a clear empty state`, async ({ page }) => {
    await page.goto(`/${name}/?ui=gui`);
    const article = page.locator(`[data-authored-page="${name}"]`);
    await expect(article.locator('h1')).toBeVisible();
    const source = entries.find((entry) => entry.filePath === `pages/${name}.md`);
    if (!source) await expect(article.locator('[data-authored-page-empty]')).toBeVisible();
    else await expect(article.locator('.prose')).toBeVisible();
  });
}

test('approved device summaries stay confined to Uses and excluded from Pagefind and general catalogs', async ({
  page,
  request,
}) => {
  await page.goto('/uses/?ui=gui#hardware');
  for (const summary of summaries) {
    const row = page.locator('#hardware [data-object-row]').filter({ hasText: summary.title });
    await expect(row).toHaveCount(1);
    expect(await row.evaluate((node) => Boolean(node.closest('[data-pagefind-ignore]')))).toBe(
      true,
    );
  }
  for (const endpoint of [
    'notes-catalog',
    'uses-catalog',
    'terminal/notes',
    'terminal/external',
    'terminal/services',
    'terminal/hosts',
    'terminal/network',
    'terminal/blogroll',
    'terminal/carry',
    'terminal/defaults',
  ]) {
    const response = await request.get(`/data/${endpoint}.json`);
    expect(response.ok()).toBe(true);
    const text = await response.text();
    for (const summary of summaries) {
      expect(text).not.toContain('uses-summary-' + summary.id);
      expect(text).not.toContain('"id":' + JSON.stringify(summary.id));
    }
  }
  const titles = summaries.map((summary) => summary.title);
  const indexed = await page.evaluate(async (phrases) => {
    const runtimePath = '/pagefind/pagefind.js';
    const pagefind = await import(runtimePath);
    const result: Array<{ url: string; excerpt: string }> = [];
    for (const phrase of phrases) {
      const response = await pagefind.search('"' + phrase + '"');
      for (const hit of response.results) result.push(await hit.data());
    }
    return result;
  }, titles);
  expect(
    indexed.filter(
      (row) => new URL(row.url, 'https://example.org').pathname.replace(/\/$/, '') === '/uses',
    ),
  ).toEqual([]);
});
