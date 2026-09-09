export const INITIAL_NOTE_CARD_COUNT = 12;

type CatalogEntry = {
  id: string;
};

function isCatalogEntry(value: unknown): value is CatalogEntry {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && typeof value.id === 'string';
}

export function assertNotesCatalogBoundary(notesHtml: string, catalogPayload: unknown): void {
  if (!Array.isArray(catalogPayload) || !catalogPayload.every(isCatalogEntry)) {
    throw new Error('Notes catalog boundary check requires a valid catalog array.');
  }

  const noteCardCount = notesHtml.match(/data-note-card/g)?.length || 0;
  const noteIds = [...notesHtml.matchAll(/data-note-id="([^"]+)"/g)].map(match => match[1]);
  const initialIds = catalogPayload.slice(0, INITIAL_NOTE_CARD_COUNT).map(entry => entry.id);
  const deferredIds = catalogPayload.slice(INITIAL_NOTE_CARD_COUNT).map(entry => entry.id);
  if (deferredIds.some(id => noteIds.includes(id))) {
    throw new Error('Deferred catalog entries are embedded in /notes HTML.');
  }
  if (noteCardCount !== INITIAL_NOTE_CARD_COUNT || noteIds.length !== INITIAL_NOTE_CARD_COUNT) {
    throw new Error(`Expected exactly ${INITIAL_NOTE_CARD_COUNT} SSR note cards, found ${noteCardCount}.`);
  }
  if (new Set(noteIds).size !== noteIds.length) {
    throw new Error('SSR note card IDs must be unique.');
  }

  if (JSON.stringify(noteIds) !== JSON.stringify(initialIds)) {
    throw new Error('SSR note cards must match the catalog boundary in order.');
  }


  if (notesHtml.includes('notes-catalog.json') || notesHtml.includes('data-notes-catalog')) {
    throw new Error('The full notes catalog must not be embedded in /notes HTML.');
  }
}
