import { INITIAL_TOOL_CARD_COUNT } from '../src/view-models/tools-catalog';

type CatalogBookmark = {
  slug: string;
};

type CatalogGroup = {
  name: string;
  slug: string;
  bookmarks: CatalogBookmark[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCatalogBookmark(value: unknown): value is CatalogBookmark {
  return isRecord(value) && typeof value.slug === 'string';
}

function isCatalogGroup(value: unknown): value is CatalogGroup {
  return isRecord(value)
    && typeof value.name === 'string'
    && typeof value.slug === 'string'
    && Array.isArray(value.bookmarks)
    && value.bookmarks.every(isCatalogBookmark);
}

export function assertToolsCatalogBoundary(toolsHtml: string, catalogPayload: unknown): void {
  if (!Array.isArray(catalogPayload) || !catalogPayload.every(isCatalogGroup)) {
    throw new Error('Tools catalog boundary check requires a valid grouped catalog array.');
  }

  const totalCatalogCards = catalogPayload.reduce((total, group) => total + group.bookmarks.length, 0);
  if (totalCatalogCards <= INITIAL_TOOL_CARD_COUNT) {
    throw new Error('Tools catalog boundary requires deferred catalog entries.');
  }

  const ssrCards = toolsHtml.match(/data-bookmark-card/g)?.length ?? 0;
  if (ssrCards !== INITIAL_TOOL_CARD_COUNT) {
    throw new Error(`Expected exactly ${INITIAL_TOOL_CARD_COUNT} SSR tool cards, found ${ssrCards}.`);
  }

  const ssrSlugs = [...toolsHtml.matchAll(/data-bookmark-slug="([^"]+)"/g)].map(match => match[1]);
  const expectedSlugs = catalogPayload
    .flatMap(group => group.bookmarks)
    .slice(0, INITIAL_TOOL_CARD_COUNT)
    .map(bookmark => bookmark.slug);
  if (JSON.stringify(ssrSlugs) !== JSON.stringify(expectedSlugs)) {
    throw new Error('SSR tool cards must match the leading catalog assignments in order.');
  }

  if (toolsHtml.includes('data-tools-catalog')) {
    throw new Error('The full tools catalog must not be embedded in /tools HTML.');
  }

  if (/\sonerror=/.test(toolsHtml)) {
    throw new Error('/tools must not ship inline error handlers for bookmark fallbacks.');
  }
}
