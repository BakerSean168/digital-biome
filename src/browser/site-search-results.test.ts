import assert from 'node:assert/strict';
import test from 'node:test';
import type { SearchNavigationCommand } from '../config/navigation-policy';
import { matchSearchPalette, toSearchResult, type ServiceResult } from './site-search-results';

const routes: SearchNavigationCommand[] = [
  {
    type: 'cmd',
    label: 'NAV',
    title: 'Tools',
    href: '/tools',
    desc: 'Resources',
    alias: ['tools'],
  },
];

function service(index: number): ServiceResult {
  return {
    type: 'service',
    label: 'SVC',
    title: `Service ${index}`,
    desc: 'Service',
    href: '/systems',
    aliases: [`service-${index}`],
    pinned: true,
  };
}

test('blank Search preserves all navigation and the first six pinned public services', () => {
  const matched = matchSearchPalette(
    '',
    routes,
    Array.from({ length: 8 }, (_, index) => service(index)),
  );
  assert.equal(matched[0].href, '/tools');
  assert.equal(matched.length, 7);
  assert.equal(matched.at(-1)?.title, 'Service 5');
});

test('Search preserves case-normalized command and service matches without auto-exposing private URLs', () => {
  assert.deepEqual(
    matchSearchPalette('TOOLS', routes, [service(0)]).map((item) => item.href),
    ['/tools'],
  );
  assert.deepEqual(
    matchSearchPalette('service-1', routes, [service(0), service(1)]).map((item) => item.href),
    ['/systems'],
  );
});

test('Pagefind rows preserve title fallback and converted excerpts', () => {
  const result = toSearchResult({
    url: '/notes/obsidian/example-page/',
    excerpt: '<mark>Example</mark> documentation',
    meta: {},
  });
  assert.equal(result.title, 'example page');
  assert.equal(result.href, '/notes/obsidian/example-page/');
  assert.equal(result.type, 'search');
  assert.match(result.desc, /Example/);
});
