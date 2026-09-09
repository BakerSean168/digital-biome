import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterDiscoverAssetResults,
  parseDiscoverAssetResults,
  readDiscoverAssetResults,
  toDiscoverResult,
  type DiscoverAssetResult,
} from './discover';
import { searchPagefind } from './pagefind';

const asset: DiscoverAssetResult = {
  id: 'asset/astro',
  scope: 'assets',
  kind: 'tool',
  label: 'tool',
  title: 'Astro',
  description: 'Static site toolkit',
  tags: ['web/astro'],
  href: '/tools/astro',
};

test('reads Discover asset JSON from a template content island', () => {
  const serialized = JSON.stringify([asset]);
  assert.deepEqual(readDiscoverAssetResults({
    textContent: '',
    content: { textContent: serialized },
  }), [asset]);
});

test('parses escaped asset data and ignores malformed entries', () => {
  const serialized = JSON.stringify([asset, { id: 'invalid' }]).replace(/</g, '\\u003c');
  assert.deepEqual(parseDiscoverAssetResults(serialized), [asset]);
  assert.deepEqual(parseDiscoverAssetResults('{malformed'), []);
});

test('normalizes Pagefind excerpt markup into safe readable text', () => {
  const result = toDiscoverResult({
    url: '/tools/astro',
    excerpt: '<mark>Astro</mark> toolkit',
    meta: {},
  });

  assert.equal(result.description, 'Astro toolkit');
  assert.doesNotMatch(result.description, /<[^>]+>/);
});

test('keeps matching asset fallback results when Pagefind is unavailable', async () => {
  const assets = readDiscoverAssetResults({
    textContent: '',
    content: { textContent: JSON.stringify([asset]) },
  });
  const outcome = await searchPagefind(async () => null, 'astro');
  assert.equal(outcome.status, 'unavailable');
  assert.deepEqual(filterDiscoverAssetResults(assets, '', 'all'), [asset]);
  assert.deepEqual(filterDiscoverAssetResults(assets, 'astro', 'all'), [asset]);
  assert.deepEqual(filterDiscoverAssetResults(assets, 'astro', 'notes'), []);
});
