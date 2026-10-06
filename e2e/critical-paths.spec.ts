import { expect, test, type APIRequestContext } from '@playwright/test';
import type { TerminalObject } from '../src/view-models/terminal-object';

async function catalog(request: APIRequestContext, name: string): Promise<TerminalObject[]> {
  const response = await request.get(`/data/terminal/${name}.json`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}
const browser = '[data-object-browser]:visible';
const rows = `${browser} [data-object-row]`;
const query = `${browser} [data-object-filter]`;

test('Notes retains 12 SSR objects and loads its catalog only on demand', async ({
  page,
  request,
}) => {
  const response = await request.get('/notes/');
  expect(response.ok()).toBeTruthy();
  expect((await response.text()).match(/data-object-row/g)).toHaveLength(12);
  let catalogRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/data/terminal/notes.json')) catalogRequests++;
  });
  await page.goto('/notes/');
  await expect(page.locator(rows)).toHaveCount(12);
  expect(catalogRequests).toBe(0);
  await page.locator(`${browser} [data-object-more]`).click();
  await expect(page.locator(rows)).toHaveCount(36);
  expect(catalogRequests).toBe(1);
});

test('Notes restores combined URL filters and clears query without losing tag or UI mode', async ({
  page,
  request,
}) => {
  const sample = (await catalog(request, 'notes')).find(
    (note) => note.title.length >= 4 && note.tags.length,
  );
  expect(sample).toBeTruthy();
  if (!sample) return;
  await page.goto(
    `/notes/?ui=gui&q=${encodeURIComponent(sample.title)}&tag=${encodeURIComponent(sample.tags[0])}`,
  );
  await expect(page.locator(query)).toHaveValue(sample.title);
  await expect(page.locator(`${browser} [data-facet-chips]`)).toContainText(sample.tags[0]);
  await expect(page.locator(rows).first()).toContainText(sample.title);
  await page.locator(query).press('Escape');
  await expect(page.locator(query)).toHaveValue('');
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
  expect(new URL(page.url()).searchParams.get('tag')).toBe(sample.tags[0]);
  await page.getByRole('button', { name: '清除筛选', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('ui')).toBe('gui');
  expect(new URL(page.url()).searchParams.has('tag')).toBe(false);
});

test('Search returns real Pagefind content and service navigation', async ({ page }) => {
  await page.goto('/?ui=gui');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#search-modal')).toHaveAttribute('aria-hidden', 'false');
  await page.locator('#cmd-input').fill('typescript');
  await expect(page.locator('#cmd-results')).toContainText(/typescript/i, { timeout: 15_000 });
  await expect(page.locator('#cmd-results')).toContainText('doc');
  await page.locator('#cmd-input').fill('litellm');
  await expect(page.locator('#cmd-results')).toContainText('LiteLLM');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/systems\?ui=gui#service-svc-litellm-model-gateway$/);
});

test('Tools bounds external SSR to 16 and lazy-loads the shared catalog', async ({
  page,
  request,
}) => {
  const response = await request.get('/tools/');
  expect((await response.text()).match(/data-terminal-kind="external"/g)).toHaveLength(16);
  await page.goto('/tools/?ui=gui#external');
  await expect(page.locator(rows)).toHaveCount(16);
  await page.locator(`${browser} [data-object-more]`).click();
  await expect(page.locator(rows)).toHaveCount(
    Math.min(40, (await catalog(request, 'external')).length),
  );
});

test('Mode choice preserves selection, query, facets and category; back restores entry state', async ({
  page,
}) => {
  await page.goto('/tools/?ui=tui#services');
  await page.keyboard.press('i');
  await expect(page.locator(query)).toBeFocused();
  await page.locator(query).fill('');
  await page.locator(query).press('Enter');
  await page.keyboard.press('f');
  const dialog = page.locator('dialog[open][data-facet-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-facet-options] button').first().click();
  await dialog.locator('[data-facet-apply]').click();
  const chips = await page.locator(`${browser} [data-facet-chips] button`).allTextContents();
  const title = await page.locator(`${rows}[aria-current="true"] strong`).innerText();
  await page.locator('[data-ui-mode-choice="gui"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'gui');
  expect(new URL(page.url()).searchParams.has('ui')).toBe(false);
  await expect(page.locator(`${browser} [data-facet-chips] button`)).toHaveText(chips);
  await expect(page.locator(`${rows}[aria-current="true"] strong`)).toHaveText(title);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'gui');
  await expect(page.locator(`${rows}[aria-current="true"] strong`)).toHaveText(title);
  await page.locator('[data-tools-tab="external"]').click();
  await page.locator(query).fill('github');
  await expect(page.locator(rows).first()).toContainText(/github/i);
  await page.goBack();
  await expect(page.locator('[data-tools-tab="services"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator(`${browser} [data-facet-chips] button`)).toHaveText(chips);
  await page.goForward();
  await expect(page.locator(query)).toHaveValue('github');
});

test('URL mode is temporary, propagates to navigation and manual choice persists', async ({
  page,
}) => {
  await page.goto('/?ui=gui');
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'gui');
  await page.locator('[data-terminal-dock] a[href*="/about"]').click();
  await expect(page).toHaveURL(/\/about\/?\?ui=gui$/);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'tui');
  await page.locator('[data-ui-mode-choice="gui"]').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ui', 'gui');
});

test('Facet cancellation and catalog failure do not commit a partial filter', async ({ page }) => {
  await page.goto('/tools/#external');
  await page.route('**/data/terminal/external.json', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await page.keyboard.press('f');
  await expect(page.locator(`${browser} [data-object-error]`)).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.unroute('**/data/terminal/external.json');
  await page.keyboard.press('f');
  const dialog = page.locator('dialog[open]');
  await dialog.locator('[data-facet-options] button').first().click();
  await dialog.locator('[data-facet-cancel]').click();
  await expect(page.locator(`${browser} [data-facet-chips]`)).toBeEmpty();
});

test('Mocked private binding unlocks both SSR and lazily rendered service links', async ({
  page,
  request,
}) => {
  const services = await catalog(request, 'services');
  const sample = services.slice(12).find((item) => item.privateRef);
  expect(sample, 'fixture must include a lazy private service').toBeTruthy();
  if (!sample?.privateRef) return;
  const privateRef = sample.privateRef;
  const target = 'https://owner.example.test:10446/';
  await page.route('**/api/private/infrastructure', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 1,
        values: {},
        links: {
          [privateRef]: target,
          'svc-litellm-model-gateway.links.admin': target,
        },
      }),
    }),
  );
  await page.goto('/tools/?ui=gui');
  await page.locator(`${browser} [data-object-more]`).click();
  const link = page.locator(`${rows}[data-private-link="${sample.privateRef}"]`);
  await expect(link).toHaveAttribute('href', target);
  await expect(link).toHaveAttribute('target', '_blank');
  const snapshot = await page.evaluate(() => JSON.stringify(history.state));
  expect(snapshot).not.toContain('owner.example.test');
  await page.goto('/infrastructure/svc-litellm-model-gateway/?ui=gui');
  await expect(
    page.locator('[data-private-link="svc-litellm-model-gateway.links.admin"]').first(),
  ).toHaveAttribute('href', target);
});

test('Mobile GUI details close back to the same list, with no outer scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/?ui=gui#external');
  const title = await page.locator(`${rows} strong`).first().innerText();
  await page.locator(`${rows} strong`).first().click();
  await expect(page.locator('[data-object-detail][open]')).toContainText(title);
  await page.getByRole('button', { name: '关闭详情' }).click();
  await expect(page.locator('[data-object-detail][open]')).toHaveCount(0);
  await expect(page.locator(`${rows}[aria-current="true"] strong`)).toHaveText(title);
  for (const route of [
    '/',
    '/about',
    '/tools',
    '/notes',
    '/blog',
    '/dev',
    '/friends',
    '/login',
    '/systems',
    '/infrastructure',
    '/about/tags',
    '/404',
    '/projects/project-memoflow',
  ]) {
    await page.goto(`${route}?ui=gui`);
    const geometry = await page.evaluate(() => ({
      bodyHeight: document.body.scrollHeight,
      height: innerHeight,
      bodyWidth: document.body.scrollWidth,
      contentWidth: document.querySelector('#site-content')?.scrollWidth ?? Infinity,
      width: innerWidth,
      dockBottom:
        document.querySelector('[data-terminal-dock]')?.getBoundingClientRect().bottom ?? Infinity,
    }));
    expect(geometry.bodyHeight, route).toBeLessThanOrEqual(geometry.height);
    expect(geometry.bodyWidth, route).toBeLessThanOrEqual(geometry.width);
    expect(geometry.contentWidth, route).toBeLessThanOrEqual(geometry.width);
    expect(geometry.dockBottom, route).toBeLessThanOrEqual(geometry.height);
  }
});

test('Tag directory remains complete while About uses bounded content', async ({ page }) => {
  await page.goto('/about/tags/?ui=gui');
  const expected = Number(
    await page.locator('[data-tag-directory]').getAttribute('data-tag-count'),
  );
  expect(expected).toBeGreaterThan(100);
  await expect(page.locator('a.tag-chip')).toHaveCount(expected);
  await page.goto('/about/?ui=gui');
  await expect(page.locator('h1:visible')).toContainText('构建系统');
  await expect(page.locator('[data-heatmap-grid]')).toHaveCount(0);
});

test('Reading keeps its visible heading on mode change and TOC tracks decorated anchors', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/notes/obsidian/typescript-utility-types?ui=gui');
  const headings = page.locator('.prose h2[id], .prose h3[id]');
  expect(await headings.count()).toBeGreaterThan(2);
  const heading = headings.nth(1);
  const id = await heading.getAttribute('id');
  await heading.evaluate((element) => element.scrollIntoView({ block: 'start' }));
  const position = () =>
    heading.evaluate(
      (element) =>
        element.getBoundingClientRect().top -
        (document.getElementById('site-content')?.getBoundingClientRect().top ?? 0),
    );
  const before = await position();
  await page.locator('[data-ui-mode-choice="tui"]').click();
  await expect.poll(async () => Math.abs((await position()) - before)).toBeLessThan(4);
  await page.locator('[data-ui-mode-choice="gui"]').click();
  const link = page
    .locator('[data-table-of-contents] a')
    .filter({ hasText: await heading.innerText() })
    .first();
  await link.click();
  expect(decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe(id);
  await expect
    .poll(() => link.evaluate((element) => element.classList.contains('text-primary')))
    .toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#site-content').evaluate((element) => element.scrollWidth)).toBe(390);
});

test('IME confirmation stays in input and Search close keeps native Enter behavior', async ({
  page,
}) => {
  await page.goto('/tools?ui=gui');
  const input = page.locator(query);
  await input.focus();
  const cancelled = await input.evaluate(
    (element) =>
      !element.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
  );
  expect(cancelled).toBe(false);
  await expect(input).toBeFocused();
  await page.keyboard.press('Control+k');
  const url = page.url();
  await page.locator('#cmd-input').evaluate((element) =>
    element.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await expect(page.locator('#search-modal')).toBeVisible();
  expect(page.url()).toBe(url);
  await page.locator('#cmd-close').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#search-modal')).not.toBeVisible();
  expect(page.url()).toBe(url);
});

test('Modified Tools tab clicks leave browser navigation intact', async ({ page }) => {
  await page.goto('/tools?ui=gui#services');
  for (const modifier of ['ctrlKey', 'metaKey']) {
    const prevented = await page.locator('[data-tools-tab="external"]').evaluate((element, key) => {
      let suppressed = false;
      element.addEventListener(
        'click',
        (event) => {
          suppressed = event.defaultPrevented;
          // Observe application handling, then keep this synthetic event from navigating.
          event.preventDefault();
        },
        { once: true },
      );
      element.dispatchEvent(
        new MouseEvent('click', { [key]: true, bubbles: true, cancelable: true }),
      );
      return suppressed;
    }, modifier);
    expect(prevented).toBe(false);
    expect(new URL(page.url()).hash).toBe('#services');
  }
});

test('About retains full content and a shared reading anchor across mobile modes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about?ui=gui');
  await expect(
    page.locator('[data-ui-only="gui"] [data-reading-anchor="about-content"]'),
  ).toContainText('Notes');
  await expect(
    page.locator('[data-ui-only="gui"] [data-reading-anchor="about-content"]'),
  ).toContainText('Blog');
  const key = '[data-reading-anchor="about-practice"]:visible';
  await page.locator(key).evaluate((element) => element.scrollIntoView({ block: 'start' }));
  const position = () =>
    page
      .locator(key)
      .evaluate(
        (element) =>
          element.getBoundingClientRect().top -
          (document.getElementById('site-content')?.getBoundingClientRect().top ?? 0),
      );
  const before = await position();
  await page.locator('[data-ui-mode-choice="tui"]').click();
  await expect.poll(async () => Math.abs((await position()) - before)).toBeLessThan(4);
  await page.locator('[data-ui-mode-choice="gui"]').click();
  await expect.poll(async () => Math.abs((await position()) - before)).toBeLessThan(4);
});

test('About switches modes while reading inside a definition list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await page.goto('/about?ui=gui');
  const section = page.locator('[data-reading-anchor="about-content"]:visible');
  await section.evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
    const content = document.getElementById('site-content');
    if (content) content.scrollTop += 60;
  });
  const position = () =>
    section.evaluate(
      (element) =>
        element.getBoundingClientRect().top -
        (document.getElementById('site-content')?.getBoundingClientRect().top ?? 0),
    );
  const before = await position();
  await page.locator('[data-ui-mode-choice="tui"]').click();
  await expect.poll(async () => Math.abs((await position()) - before)).toBeLessThan(4);
});

test('About keeps the reading section visible when the shorter mode reaches its scroll limit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about?ui=gui');
  await page.locator('[data-reading-anchor="about-content"]:visible').evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
    const content = document.getElementById('site-content');
    if (content) content.scrollTop += 60;
  });
  await page.locator('[data-ui-mode-choice="tui"]').click();
  await expect(page.locator('[data-reading-anchor="about-content"]:visible')).toBeInViewport();
  await expect
    .poll(() =>
      page
        .locator('#site-content')
        .evaluate((element) =>
          Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop),
        ),
    )
    .toBeLessThan(2);
});
