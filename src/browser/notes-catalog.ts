import type { NoteCatalogItem } from '../view-models/note-list-item';

export const NOTES_BATCH_SIZE = 12;

export function getNextNoteBatch(
  notes: readonly NoteCatalogItem[],
  offset: number,
  batchSize = NOTES_BATCH_SIZE,
): NoteCatalogItem[] {
  return notes.slice(offset, offset + batchSize);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNoteCatalogItem(value: unknown): value is NoteCatalogItem {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.href === 'string'
    && Array.isArray(value.tags)
    && value.tags.every(tag => typeof tag === 'string')
    && typeof value.date === 'string'
    && (typeof value.timestamp === 'number' || value.timestamp === null);
}

export function parseNoteCatalogPayload(payload: unknown): NoteCatalogItem[] {
  if (!Array.isArray(payload) || !payload.every(isNoteCatalogItem)) {
    throw new Error('Notes catalog response was malformed.');
  }
  return payload;
}

export async function fetchNotesCatalog(
  fetcher: typeof fetch = fetch,
): Promise<NoteCatalogItem[]> {
  const response = await fetcher('/data/notes-catalog.json', {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Notes catalog request failed: ${response.status}`);
  return parseNoteCatalogPayload(await response.json());
}

export function createNotesCatalogLoader(
  fetcher: typeof fetch = fetch,
): () => Promise<NoteCatalogItem[]> {
  let catalog: NoteCatalogItem[] | null = null;
  let request: Promise<NoteCatalogItem[]> | null = null;

  return () => {
    if (catalog) return Promise.resolve(catalog);
    if (!request) {
      request = fetchNotesCatalog(fetcher)
        .then(notes => {
          catalog = notes;
          return notes;
        })
        .catch(error => {
          request = null;
          throw error;
        });
    }
    return request;
  };
}
