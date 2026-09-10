import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_TOOL_CARD_COUNT } from '../src/view-models/tools-catalog';
import { assertToolsCatalogBoundary } from './tools-catalog-boundary';

function payload(count: number) {
  return [{
    name: 'tech/ai',
    slug: 'tech/ai',
    bookmarks: Array.from({ length: count }, (_, index) => ({ slug: `obsidian/tool-${index}` })),
  }];
}

test('accepts a bounded SSR prefix and rejects an expanded tools shell', () => {
  const catalog = payload(INITIAL_TOOL_CARD_COUNT + 4);
  const html = catalog[0].bookmarks
    .slice(0, INITIAL_TOOL_CARD_COUNT)
    .map(item => `<div data-bookmark-card data-bookmark-slug="${item.slug}"></div>`)
    .join('');

  assert.doesNotThrow(() => assertToolsCatalogBoundary(html, catalog));
  assert.throws(() => assertToolsCatalogBoundary(`${html}<div data-bookmark-card></div>`, catalog));
  assert.throws(() => assertToolsCatalogBoundary(`${html}<img onerror="alert(1)">`, catalog));
});
