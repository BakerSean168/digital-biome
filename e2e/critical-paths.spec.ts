import { expect, test, type APIRequestContext } from '@playwright/test';

type NoteCatalogItem = {
  id: string;
  title: string;
  tags: string[];
};

type ToolCatalogGroup = {
  name: string;
  slug: string;
  bookmarks: Array<{ title: string; slug: string }>;
};

async function readJson<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(path);
  expect(response.ok(), `${path} should be available from the production preview`).toBeTruthy();
  return response.json() as Promise<T>;
}

test('Notes keeps an SSR boundary and lazy-loads the catalog in Chromium', async ({ page, request }) => {
  const response = await request.get('/notes/');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html.match(/data-note-card/g) ?? []).toHaveLength(12);
  expect(html).not.toContain('data-notes-catalog');

  await page.goto('/notes/');
  await expect(page.locator('#notes-list > a')).toHaveCount(12);
  await expect(page.locator('#load-more-sentinel')).toBeVisible();

  const catalogResponse = page.waitForResponse(response =>
    response.url().endsWith('/data/notes-catalog.json') && response.ok(),
  );
  await page.locator('#load-more-sentinel').scrollIntoViewIfNeeded();
  await catalogResponse;
  await expect.poll(() => page.locator('#notes-list > a').count()).toBeGreaterThan(12);
});

test('Notes restores query and tag intent from the URL', async ({ page, request }) => {
  const catalog = await readJson<NoteCatalogItem[]>(request, '/data/notes-catalog.json');
  const sample = catalog.find(note => note.title.trim().length >= 4 && note.tags.length > 0);
  expect(sample).toBeTruthy();
  if (!sample) return;

  const tag = sample.tags[0];
  const url = `/notes/?q=${encodeURIComponent(sample.title)}&tag=${encodeURIComponent(tag)}`;
  await page.goto(url);

  await expect(page.locator('#title-search')).toHaveValue(sample.title);
  await expect(page.locator('#tag-container')).toContainText(tag.split('/').pop() || tag);
  await expect(page.locator('#notes-list')).toContainText(sample.title);

  await expect(page.locator('#clear-filters')).toBeVisible();
  await page.locator('#clear-filters').click();
  await expect(page.locator('#title-search')).toHaveValue('');
  await expect(page.locator('#tag-container')).toBeEmpty();
  await expect(page).toHaveURL(/\/notes\/?$/);
});

test('SiteSearch returns real Pagefind document results', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#search-modal')).toHaveAttribute('aria-hidden', 'false');

  await page.locator('#cmd-input').fill('typescript');
  await expect(page.locator('#cmd-results')).toContainText('[ DOC ]', { timeout: 15_000 });
  await expect(page.locator('#cmd-results')).toContainText(/typescript/i);
});

test('Discover falls back to typed public assets when Pagefind is unavailable', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', route => route.abort('failed'));
  await page.goto('/discover/?q=ForgeFlow');

  await expect(page.locator('#discover-search-status')).toContainText('全文索引暂时不可用', { timeout: 10_000 });
  await expect(page.locator('#discover-results')).toContainText('ForgeFlow');
  await expect(page.locator('#discover-results')).toContainText('[ ASSETS ]');
});

test('Tools keeps 16 SSR cards, lazy-loads the full catalog, and honors category URL state', async ({ page, request }) => {
  const catalog = await readJson<ToolCatalogGroup[]>(request, '/data/tools-catalog.json');
  const totalAssignments = catalog.reduce((total, group) => total + group.bookmarks.length, 0);
  expect(totalAssignments).toBeGreaterThan(16);

  const response = await request.get('/tools/');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html.match(/data-bookmark-card/g) ?? []).toHaveLength(16);
  expect(html).not.toContain('data-tools-catalog');
  expect(html).not.toMatch(/\sonerror=/);

  const fullCatalogResponse = page.waitForResponse(response =>
    response.url().endsWith('/data/tools-catalog.json') && response.ok(),
  );
  await page.goto('/tools/');
  await expect(page.locator('[data-bookmark-card]')).toHaveCount(16);
  await page.locator('#bookmark-load-more-sentinel').scrollIntoViewIfNeeded();
  await fullCatalogResponse;
  await expect(page.locator('[data-bookmark-card]')).toHaveCount(totalAssignments);


  const group = catalog.find(entry => entry.bookmarks.length > 0);
  expect(group).toBeTruthy();
  if (!group) return;

  await page.goto(`/tools/?c=${encodeURIComponent(group.slug)}`);
  await expect(page.locator('.id-current-filter')).toHaveText(group.slug.toUpperCase());
  await expect(page.locator('[data-bookmark-card]')).toHaveCount(group.bookmarks.length);
  await expect(page).toHaveURL(new RegExp(`[?&]c=${encodeURIComponent(group.slug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:&|$)`));
});


test('About surfaces keep full SSR data with compact markup', async ({ page }) => {
  await page.goto('/about/tags/');
  const directory = page.locator('[data-tag-directory]');
  const expectedTags = Number.parseInt((await directory.getAttribute('data-tag-count')) || '0', 10);
  expect(expectedTags).toBeGreaterThan(100);
  await expect(page.locator('a.tag-chip')).toHaveCount(expectedTags);
  await expect(page.locator('.lucide-tag')).toHaveCount(0);

  await page.goto('/about/');
  const heatmap = page.locator('[data-heatmap-grid]');
  await expect(heatmap).toHaveAttribute('role', 'img');
  const firstCell = page.locator('.contribution-cell').first();
  await expect(firstCell).toHaveAttribute('data-tooltip', /.+/);
  expect(await firstCell.evaluate(element => element.childElementCount)).toBe(0);
  await firstCell.hover();
  const pseudoContent = await firstCell.evaluate(element => getComputedStyle(element, '::after').content);
  expect(pseudoContent).not.toBe('none');
  expect(pseudoContent).not.toBe('normal');
});
