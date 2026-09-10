import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterNoteCatalog,
  sortNoteCatalog,
  toNoteCatalogItem,
  type NoteCatalogItem,
} from '../view-models/note-list-item';

const catalog: NoteCatalogItem[] = [
  {
    id: 'obsidian/alpha',
    title: 'Alpha note',
    description: 'A note about TypeScript',
    href: '/notes/obsidian/alpha',
    tags: ['tech/typescript', 'status/growing'],
    date: '今天',
    timestamp: 3,
  },
  {
    id: 'obsidian/beta',
    title: 'Beta note',
    description: 'A note about design',
    href: '/notes/obsidian/beta',
    tags: ['tech/design', 'life/reading'],
    date: '昨天',
    timestamp: 2,
  },
  {
    id: 'obsidian/gamma',
    title: 'Gamma note',
    description: 'A note about systems',
    href: '/notes/obsidian/gamma',
    tags: ['tech/typescript', 'life/reading'],
    date: '前天',
    timestamp: 1,
  },
];

test('sorts catalog newest first without mutating the input', () => {
  const unsorted = [catalog[1], catalog[0], catalog[2]];
  assert.deepEqual(sortNoteCatalog(unsorted).map(note => note.id), [
    'obsidian/alpha',
    'obsidian/beta',
    'obsidian/gamma',
  ]);
  assert.deepEqual(unsorted.map(note => note.id), [
    'obsidian/beta',
    'obsidian/alpha',
    'obsidian/gamma',
  ]);
});

test('keeps query matching across title, description, id, and tags', () => {
  assert.deepEqual(filterNoteCatalog(catalog, 'TYPESCRIPT', []).map(note => note.id), [
    'obsidian/alpha',
    'obsidian/gamma',
  ]);
  assert.deepEqual(filterNoteCatalog(catalog, 'beta', []).map(note => note.id), ['obsidian/beta']);
});

test('requires every active tag while retaining hierarchical substring matching', () => {
  assert.deepEqual(filterNoteCatalog(catalog, '', ['tech/typescript', 'reading']).map(note => note.id), [
    'obsidian/gamma',
  ]);
});

test('projects only public card fields into the catalog item', () => {
  const item = toNoteCatalogItem({
    id: 'obsidian/alpha',
    data: {
      title: 'Alpha note',
      description: 'Description',
      tags: ['tech/typescript'],
      created: new Date('2024-01-01T00:00:00Z'),
      private: true,
      draft: true,
    },
  } as Parameters<typeof toNoteCatalogItem>[0], new Date('2024-01-03T00:00:00Z'));

  assert.deepEqual(Object.keys(item).sort(), [
    'date',
    'description',
    'href',
    'id',
    'tags',
    'timestamp',
    'title',
  ]);
});
