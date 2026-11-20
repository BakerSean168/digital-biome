import assert from 'node:assert/strict';
import test from 'node:test';
import type { NoteIndexEntry } from '../types/knowledge-index';
import {
  findDefaultConflicts,
  selectHomepageResources,
  selectResourceEntries,
  toResourceObject,
} from './resource-collections';

function card(kind: string, id: string, override: Partial<NoteIndexEntry> = {}): NoteIndexEntry {
  return {
    id: `obsidian/uses/${kind}/${id}`,
    title: id,
    tags: [],
    aliases: [],
    type: 'resource',
    draft: false,
    private: false,
    visibility: 'public',
    isAsset: kind === 'hardware',
    filePath: `uses/${kind}/${id}.md`,
    ...override,
  };
}

test('new resource collections are explicitly public and selected by properties, not URLs', () => {
  const source = [
    card('websites', 'site', { bookmarked: true, url: 'https://example.org/' }),
    card('websites', 'blog', {
      bookmarked: true,
      status: 'active',
      tags: ['blogroll'],
      url: 'https://blog.example.org/',
    }),
    card('software', 'editor', { status: 'active', defaultFor: ['editing'], bookmarked: true }),
    card('software', 'editor-backup', {
      status: 'active',
      defaultFor: ['editing'],
      showOnUses: false,
    }),
    card('hardware', 'keyboard', {
      status: 'active',
      tags: ['carry'],
      asset_id: 'tool-keyboard',
      asset_type: 'tool',
    }),
    card('hardware', 'sold', { status: 'sold', tags: ['carry'], bookmarked: true }),
    card('hardware', 'private', {
      private: true,
      visibility: 'private',
      status: 'active',
      tags: ['carry'],
      description: 'secret purchase price',
      bookmarked: true,
      defaultFor: ['private'],
    }),
    card('websites', 'draft', { visibility: 'public', draft: true, bookmarked: true }),
    card('websites', 'missing-explicit', { visibility: undefined, bookmarked: true }),
    card('websites', 'description-note', { url: 'https://example.net/' }),
  ];
  const ids = (view: 'uses' | 'carry' | 'blogroll' | 'defaults' | 'bookmarks') =>
    selectResourceEntries(source, view).map((x) => x.title);
  assert.deepEqual(ids('bookmarks'), ['blog', 'editor', 'site', 'sold']);
  assert.deepEqual(ids('blogroll'), ['blog']);
  assert.deepEqual(ids('carry'), ['keyboard']);
  assert.deepEqual(ids('defaults'), ['editor', 'editor-backup']);
  assert.deepEqual(ids('uses'), ['blog', 'editor', 'keyboard']);
  assert.deepEqual(findDefaultConflicts(source), ['editing']);
  assert.equal(toResourceObject(source[1]).href, 'https://blog.example.org/');
  assert.equal(toResourceObject(source[4]).href, '/uses/tool-keyboard');
  assert.throws(() => toResourceObject(source[6]), /non-public/);
});

test('sort order is optional and stable for same-title resources', () => {
  const rows = [
    card('websites', 'b', { title: 'Same', bookmarked: true }),
    card('websites', 'a', { title: 'Same', bookmarked: true }),
    card('websites', 'first', { title: 'Zebra', bookmarked: true, order: 1 }),
  ];
  assert.deepEqual(
    selectResourceEntries(rows, 'bookmarks').map((x) => x.filePath),
    ['uses/websites/first.md', 'uses/websites/a.md', 'uses/websites/b.md'],
  );
});

test('bookmarked knowledge notes never become resource cards; only uses/websites entries do', () => {
  const note = card('websites', 'reference', {
    filePath: 'notes/reference.md',
    id: 'obsidian/reference',
    bookmarked: true,
    tags: ['type/resource', 'blogroll'],
    url: 'https://example.org/',
  });
  const plain = { ...note, id: 'obsidian/plain', bookmarked: undefined };
  assert.deepEqual(selectResourceEntries([plain, note], 'bookmarks'), []);
  assert.deepEqual(selectResourceEntries([plain, note], 'blogroll'), []);
  assert.deepEqual(selectResourceEntries([plain, note], 'uses'), []);
  assert.throws(() => toResourceObject(note), /non-public resource/);

  const website = { ...note, filePath: 'uses/websites/reference.md' };
  assert.deepEqual(
    selectResourceEntries([note, website], 'bookmarks').map((item) => item.id),
    ['obsidian/reference'],
  );
  assert.equal(toResourceObject(website).href, 'https://example.org/');
});

test('homepage curation follows edited authored order and drops unbookmarked or private resources', () => {
  const first = card('websites', 'first', { bookmarked: true, homepageOrder: 2 });
  const next = card('websites', 'next', { bookmarked: true, homepageOrder: 1 });
  const unselected = card('websites', 'unselected', { bookmarked: true });
  assert.deepEqual(
    selectHomepageResources([first, next, unselected]).map((item) => item.title),
    ['next', 'first'],
  );
  next.homepageOrder = 3;
  assert.deepEqual(
    selectHomepageResources([first, next]).map((item) => item.title),
    ['first', 'next'],
  );
  first.bookmarked = false;
  next.visibility = 'private';
  assert.deepEqual(selectHomepageResources([first, next]), []);
});
