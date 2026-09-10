import type { Bookmark } from '../types/notes';
import type { ToolCatalogGroup } from '../view-models/tools-catalog';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBookmark(value: unknown): value is Bookmark {
  return isRecord(value)
    && typeof value.title === 'string'
    && typeof value.url === 'string'
    && (value.description === undefined || typeof value.description === 'string')
    && Array.isArray(value.categories)
    && value.categories.every(category => typeof category === 'string')
    && (value.icon === undefined || typeof value.icon === 'string')
    && typeof value.slug === 'string';
}

function isToolCatalogGroup(value: unknown): value is ToolCatalogGroup {
  return isRecord(value)
    && typeof value.name === 'string'
    && typeof value.slug === 'string'
    && Array.isArray(value.bookmarks)
    && value.bookmarks.every(isBookmark);
}

export function parseToolsCatalogPayload(payload: unknown): ToolCatalogGroup[] {
  if (!Array.isArray(payload) || !payload.every(isToolCatalogGroup)) {
    throw new Error('Tools catalog response was malformed.');
  }
  return payload;
}

export async function fetchToolsCatalog(
  fetcher: typeof fetch = fetch,
): Promise<ToolCatalogGroup[]> {
  const response = await fetcher('/data/tools-catalog.json');
  if (!response.ok) throw new Error(`Tools catalog request failed: ${response.status}`);
  return parseToolsCatalogPayload(await response.json());
}

export function createToolsCatalogLoader(
  fetcher: typeof fetch = fetch,
): () => Promise<ToolCatalogGroup[]> {
  let catalog: ToolCatalogGroup[] | null = null;
  let request: Promise<ToolCatalogGroup[]> | null = null;

  return () => {
    if (catalog) return Promise.resolve(catalog);
    if (!request) {
      request = fetchToolsCatalog(fetcher)
        .then(groups => {
          catalog = groups;
          return groups;
        })
        .catch(error => {
          request = null;
          throw error;
        });
    }
    return request;
  };
}
