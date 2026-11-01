import assert from 'node:assert/strict';
import test from 'node:test';
import { initialTerminalSnapshot, updatedTerminalUrl } from './terminal-url';
import type { FacetOption } from '../view-models/terminal-filters';

const options: FacetOption[] = [
  { key: JSON.stringify(['标签', 'frontend']), group: '标签', value: 'frontend', count: 10 },
  { key: JSON.stringify(['状态', 'active']), group: '状态', value: 'active', count: 3 },
];

test('initial Terminal URL snapshot preserves exact query, tag and sorting semantics', () => {
  const url =
    'https://example.test/notes/?ui=gui&q=React&sort=title&tag=frontend&tag=backend#notes';
  assert.deepEqual(initialTerminalSnapshot(url, 'tag', 12), {
    query: 'React',
    facets: [JSON.stringify(['标签', 'frontend']), JSON.stringify(['标签', 'backend'])],
    limit: 12,
    sort: 'title',
  });
  assert.deepEqual(initialTerminalSnapshot(url, undefined, 16), {
    query: '',
    facets: [],
    limit: 16,
    sort: 'title',
  });
});

test('URL projection preserves unrelated parameters, ui mode and hash while filtering tag facets', () => {
  const url = updatedTerminalUrl(
    'https://example.test/notes/?ui=tui&unrelated=ok&q=old&tag=old#detail',
    'tag',
    'New',
    'title',
    new Set(options.map((option) => option.key)),
    options,
  );
  assert.equal(url.searchParams.get('ui'), 'tui');
  assert.equal(url.searchParams.get('unrelated'), 'ok');
  assert.equal(url.hash, '#detail');
  assert.equal(url.searchParams.get('q'), 'New');
  assert.equal(url.searchParams.get('sort'), 'title');
  assert.deepEqual(url.searchParams.getAll('tag'), ['frontend']);
});

test('empty query, default sorting and arbitrary facet keys clear only owned parameters', () => {
  const url = updatedTerminalUrl(
    'https://example.test/tools/?ui=gui&q=old&sort=title&facet=x#services',
    'facet',
    '',
    'default',
    new Set(options.map((option) => option.key)),
    options,
  );
  assert.equal(url.searchParams.has('q'), false);
  assert.equal(url.searchParams.has('sort'), false);
  assert.deepEqual(
    url.searchParams.getAll('facet'),
    options.map((option) => option.key),
  );
  assert.equal(url.searchParams.get('ui'), 'gui');
  assert.equal(url.hash, '#services');
});
