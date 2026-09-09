import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNotesCatalogLoader,
  fetchNotesCatalog,
  getNextNoteBatch,
  parseNoteCatalogPayload,
} from './notes-catalog';
import type { NoteCatalogItem } from '../view-models/note-list-item';

function note(index: number): NoteCatalogItem {
  return {
    id: `obsidian/note-${index}`,
    title: `Note ${index}`,
    description: `Description ${index}`,
    href: `/notes/obsidian/note-${index}`,
    tags: index % 2 === 0 ? ['tech/typescript'] : [],
    date: '今天',
    timestamp: index,
  };
}

test('starts the first catalog-backed batch after the SSR boundary', () => {
  const initial = Array.from({ length: 12 }, (_, index) => note(index));
  const catalog = Array.from({ length: 25 }, (_, index) => note(index));
  const nextBatch = getNextNoteBatch(catalog, initial.length);

  assert.equal(nextBatch.length, 12);
  assert.deepEqual(nextBatch.map(item => item.id), Array.from({ length: 12 }, (_, index) => `obsidian/note-${index + 12}`));
  assert.equal(new Set([...initial, ...nextBatch].map(item => item.id)).size, 24);
});

test('rejects HTTP, malformed JSON, and malformed catalog payloads', async () => {
  await assert.rejects(
    fetchNotesCatalog(async () => ({ ok: false, status: 503, json: async () => [] }) as Response),
    /503/,
  );
  await assert.rejects(
    fetchNotesCatalog(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('invalid JSON'); } }) as unknown as Response),
    /invalid JSON/,
  );
  assert.throws(() => parseNoteCatalogPayload([note(1), { id: 'broken' }]), /malformed/);
});

test('shares one catalog request and retries after a failure', async () => {
  let requestCount = 0;
  const fetcher = async () => {
    requestCount += 1;
    if (requestCount === 1) throw new Error('network unavailable');
    return { ok: true, status: 200, json: async () => [note(1)] } as Response;
  };
  const loadCatalog = createNotesCatalogLoader(fetcher);

  const firstRequest = loadCatalog();
  const secondRequest = loadCatalog();
  assert.strictEqual(firstRequest, secondRequest);
  await assert.rejects(firstRequest, /network unavailable/);
  assert.deepEqual(await loadCatalog(), [note(1)]);
  assert.equal(requestCount, 2);
});
