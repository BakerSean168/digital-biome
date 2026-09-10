import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNotesCatalogBoundary, INITIAL_NOTE_CARD_COUNT } from './notes-catalog-boundary';

const catalog = Array.from({ length: INITIAL_NOTE_CARD_COUNT + 1 }, (_, index) => ({ id: `note-${index}` }));
const notesHtml = catalog
  .slice(0, INITIAL_NOTE_CARD_COUNT)
  .map(entry => `<a data-note-card data-note-id="${entry.id}"></a>`)
  .join('');

test('proves the notes HTML contains only the intended SSR boundary', () => {
  assert.doesNotThrow(() => assertNotesCatalogBoundary(notesHtml, catalog));
  assert.throws(
    () => assertNotesCatalogBoundary(`${notesHtml}<template data-notes-catalog></template>`, catalog),
    /full notes catalog must not be embedded/,
  );
  assert.throws(
    () => assertNotesCatalogBoundary(`${notesHtml}<a data-note-id="note-12"></a>`, catalog),
    /Deferred catalog entries are embedded/,
  );
});
