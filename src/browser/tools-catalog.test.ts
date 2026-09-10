import assert from 'node:assert/strict';
import test from 'node:test';
import { createToolsCatalogLoader, parseToolsCatalogPayload } from './tools-catalog';
import { filterToolCatalog, takeInitialToolGroups } from '../view-models/tools-catalog';

const catalog = [
  {
    name: 'tech/ai',
    slug: 'tech/ai',
    bookmarks: [
      { title: 'Alpha', url: 'https://alpha.example', description: 'Agent tool', categories: ['tech/ai'], slug: 'obsidian/alpha' },
      { title: 'Beta', url: 'https://beta.example', description: 'Search', categories: ['tech/ai'], slug: 'obsidian/beta' },
    ],
  },
  {
    name: 'media/video',
    slug: 'media/video',
    bookmarks: [
      { title: 'Gamma', url: 'https://gamma.example', categories: ['media/video'], slug: 'obsidian/gamma' },
    ],
  },
];

test('validates the public tools catalog schema', () => {
  assert.equal(parseToolsCatalogPayload(catalog).length, 2);
  assert.throws(() => parseToolsCatalogPayload([{ name: 'bad', slug: 'bad', bookmarks: [{ title: 'x' }] }]));
});

test('takes a bounded SSR prefix across category groups', () => {
  const initial = takeInitialToolGroups(catalog, 2);
  assert.equal(initial.length, 1);
  assert.deepEqual(initial[0].bookmarks.map(item => item.title), ['Alpha', 'Beta']);
});

test('filters by query and exact category slug', () => {
  assert.deepEqual(filterToolCatalog(catalog, 'agent', 'all').map(group => group.bookmarks.map(item => item.title)), [['Alpha']]);
  assert.deepEqual(filterToolCatalog(catalog, '', 'media/video').map(group => group.name), ['media/video']);
  assert.deepEqual(filterToolCatalog(catalog, 'missing', 'all'), []);
});

test('tools catalog loading is single-flight, cached, and retryable', async () => {
  let calls = 0;
  let shouldFail = true;
  const fetcher = (async () => {
    calls += 1;
    if (shouldFail) {
      shouldFail = false;
      return new Response('nope', { status: 503 });
    }
    return new Response(JSON.stringify(catalog), { status: 200 });
  }) as typeof fetch;
  const load = createToolsCatalogLoader(fetcher);

  await assert.rejects(() => load());
  const [first, second] = await Promise.all([load(), load()]);
  assert.equal(calls, 2);
  assert.equal(first, second);
  assert.equal(await load(), first);
  assert.equal(calls, 2);
});
