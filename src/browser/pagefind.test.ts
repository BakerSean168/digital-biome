import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPagefindAdapter,
  hydratePagefindResults,
  hydratePagefindResultsWithStatus,
  normalizePagefindResult,
  searchPagefind,
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

test('keeps valid hydrated results when one Pagefind result rejects', async () => {
  const outcome = await hydratePagefindResultsWithStatus([
    result({ url: '/notes/valid', meta: {}, excerpt: 'valid' }),
    { data: async () => { throw new Error('result unavailable'); } },
  ]);

  assert.deepEqual(outcome.results, [{ url: '/notes/valid', excerpt: 'valid', meta: {} }]);
  assert.equal(outcome.failedCount, 1);
});

test('distinguishes unavailable, query failure, hydration failure, and zero matches', async () => {
  const unavailable = await searchPagefind(async () => null, 'missing');
  assert.equal(unavailable.status, 'unavailable');

  const queryFailed = await searchPagefind(async () => ({
    init: async () => undefined,
    search: async () => { throw new Error('query unavailable'); },
  }), 'missing');
  assert.equal(queryFailed.status, 'query-failed');

  const hydrationFailed = await searchPagefind(async () => ({
    init: async () => undefined,
    search: async () => ({ results: [{ data: async () => { throw new Error('data unavailable'); } }] }),
  }), 'missing');
  assert.equal(hydrationFailed.status, 'hydration-failed');

  const zeroMatch = await searchPagefind(async () => ({
    init: async () => undefined,
    search: async () => ({ results: [] }),
  }), 'missing');
  assert.equal(zeroMatch.status, 'zero-match');
});

test('reports partial Pagefind results instead of discarding valid data', async () => {
  const outcome = await searchPagefind(async () => ({
    init: async () => undefined,
    search: async () => ({
      results: [
        result({ url: '/notes/valid', meta: {}, excerpt: 'valid' }),
        { data: async () => { throw new Error('data unavailable'); } },
      ],
    }),
  }), 'valid');

  assert.equal(outcome.status, 'partial');
  assert.deepEqual(outcome.results, [{ url: '/notes/valid', excerpt: 'valid', meta: {} }]);
  assert.equal(outcome.failedCount, 1);
});

test('keeps synchronous and asynchronous hydration faults per Pagefind result', async () => {
  const outcome = await searchPagefind(async () => ({
    init: async () => undefined,
    search: async () => ({
      results: [
        { data: () => { throw new Error('first unavailable'); } },
        { data: () => new Promise(resolve => setTimeout(() => resolve({ url: '/notes/slow', meta: {}, excerpt: 'slow' }), 5)) },
        { data: () => { throw new Error('middle unavailable'); } },
        result({ url: '/notes/fast', meta: {}, excerpt: 'fast' }),
        {} as PagefindSearchResult,
      ],
    }),
  }), 'mixed');

  assert.equal(outcome.status, 'partial');
  assert.deepEqual(outcome.results, [
    { url: '/notes/slow', meta: {}, excerpt: 'slow' },
    { url: '/notes/fast', meta: {}, excerpt: 'fast' },
  ]);
  assert.equal(outcome.failedCount, 3);
});

test('reports hydration failure when every synchronous hydration fails', async () => {
  const outcome = await searchPagefind(async () => ({
    init: async () => undefined,
    search: async () => ({ results: [{ data: () => { throw new Error('sync unavailable'); } }, {} as PagefindSearchResult] }),
  }), 'missing');

  assert.equal(outcome.status, 'hydration-failed');
  assert.deepEqual(outcome.results, []);
  assert.equal(outcome.failedCount, 2);
});
