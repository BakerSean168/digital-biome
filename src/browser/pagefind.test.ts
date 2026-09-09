import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPagefindAdapter,
  hydratePagefindResults,
  normalizePagefindResult,
  type PagefindRuntime,
  type PagefindSearchResult,
} from './pagefind';

function result(data: unknown): PagefindSearchResult {
  return { data: async () => data };
}

test('normalizes hydrated Pagefind data into a stable result shape', () => {
  assert.deepEqual(
    normalizePagefindResult({
      url: '/notes/typed-search',
      excerpt: '<mark>typed</mark> search',
      meta: { title: 'Typed Search', ignored: 42 },
    }),
    {
      url: '/notes/typed-search',
      excerpt: '<mark>typed</mark> search',
      meta: { title: 'Typed Search' },
    },
  );
});

test('ignores malformed hydrated Pagefind data', async () => {
  const hydrated = await hydratePagefindResults([
    result({ url: '/notes/valid', meta: {}, excerpt: '' }),
    result({ url: 42 }),
    result(null),
  ]);

  assert.deepEqual(hydrated, [{ url: '/notes/valid', excerpt: '', meta: {} }]);
  assert.equal(normalizePagefindResult({ excerpt: 'missing url' }), null);
});

test('shares one initialized Pagefind promise', async () => {
  let importCount = 0;
  let initCount = 0;
  const runtime: PagefindRuntime = {
    init: async () => {
      initCount += 1;
    },
    search: async () => ({ results: [] }),
  };
  const adapter = createPagefindAdapter(async () => {
    importCount += 1;
    return runtime;
  });

  const firstLoad = adapter.load();
  const secondLoad = adapter.load();

  assert.strictEqual(firstLoad, secondLoad);
  assert.strictEqual(await firstLoad, runtime);
  assert.equal(importCount, 1);
  assert.equal(initCount, 1);
});

test('caches Pagefind import failures', async () => {
  let importCount = 0;
  const adapter = createPagefindAdapter(async () => {
    importCount += 1;
    throw new Error('index unavailable');
  });

  const firstLoad = adapter.load();
  const secondLoad = adapter.load();

  assert.strictEqual(firstLoad, secondLoad);
  assert.equal(await firstLoad, null);
  assert.equal(await secondLoad, null);
  assert.equal(importCount, 1);
});

test('caches Pagefind initialization failures', async () => {
  let initCount = 0;
  const adapter = createPagefindAdapter(async () => ({
    init: async () => {
      initCount += 1;
      throw new Error('initialization unavailable');
    },
    search: async () => ({ results: [] }),
  }));

  const firstLoad = adapter.load();
  const secondLoad = adapter.load();

  assert.strictEqual(firstLoad, secondLoad);
  assert.equal(await firstLoad, null);
  assert.equal(await secondLoad, null);
  assert.equal(initCount, 1);
});
