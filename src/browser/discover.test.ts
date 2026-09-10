import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterDiscoverAssetResults,
  parseDiscoverAssetResults,
  readDiscoverAssetResults,
  serializeDiscoverAssetResults,
  toDiscoverResult,
  type DiscoverAssetResult,
} from './discover';
import { searchPagefind } from './pagefind';
import { stripMarkupToText } from './strip-markup';

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

test('round-trips special asset text through a template content island', () => {
  const specialAsset: DiscoverAssetResult = {
    ...asset,
    title: '&quot; &#34; &amp; " 你好 </template>',
    description: 'Unicode 数据 &amp; symbols',
  };
  const templateText = serializeDiscoverAssetResults([specialAsset]);

  assert.deepEqual(readDiscoverAssetResults({
    textContent: '',
    content: { textContent: templateText },
  }), [specialAsset]);
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
  }, [asset]);

  assert.ok(result);
  assert.equal(result.description, 'Astro toolkit');
  assert.doesNotMatch(result.description, /<[^>]+>/);
});

test('decodes entities once and strips nested or malformed markup', () => {
  assert.equal(
    stripMarkupToText('<strong><mark>One &amp; &#34;two&#34; &#x1F30D; &amp;amp;</mark></strong>'),
    'One & "two" 🌍 &amp;',
  );
  assert.equal(stripMarkupToText('<mark>Unclosed &copy;'), 'Unclosed ©');
  assert.equal(stripMarkupToText('Value &lt;mark&gt;text&lt;/mark&gt;'), 'Value <mark>text</mark>');
});

test('classifies only exact asset metadata and note paths', () => {
  const assets: DiscoverAssetResult[] = [
    asset,
    { ...asset, id: 'asset/service', kind: 'service', label: 'service', href: '/services/site/' },
    { ...asset, id: 'asset/host', kind: 'host', label: 'host', href: '/infrastructure/server' },
    { ...asset, id: 'asset/network', kind: 'network', label: 'network', href: '/infrastructure/lan' },
    { ...asset, id: 'asset/project', kind: 'project', label: 'project', href: '/projects/site' },
  ];

  for (const [href, kind] of [
    ['/tools/astro/?q=one#section', 'tool'],
    ['/services/site?tab=health#status', 'service'],
    ['/infrastructure/server/#overview', 'host'],
    ['/infrastructure/lan?tab=members', 'network'],
    ['/projects/site/#readme', 'project'],
  ] as const) {
    const result = toDiscoverResult({ url: href, excerpt: '', meta: {} }, assets);
    assert.ok(result);
    assert.equal(result.scope, 'assets');
    assert.equal(result.kind, kind);
  }

  const note = toDiscoverResult({ url: '/notes/obsidian/topic/?q=one#section', excerpt: '', meta: {} }, assets);
  assert.ok(note);
  assert.equal(note.scope, 'notes');

  for (const url of ['/about', '/blog/tools/astro', '/', '/tools/not-an-asset', '/services/site-extra']) {
    assert.equal(toDiscoverResult({ url, excerpt: '', meta: {} }, assets), null);
  }
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
