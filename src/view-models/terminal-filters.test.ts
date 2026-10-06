import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFacets, facetOptions, objectPath } from './terminal-filters';
import type { TerminalObject } from './terminal-object';
const row = (id: string, meta: string, tags: string[]): TerminalObject => ({
  id,
  title: id,
  meta,
  tags,
  kind: 'host',
  href: '/infrastructure/' + id,
  description: '',
  relations: [],
});
const rows = [
  row('a', 'active', ['public']),
  row('b', 'archived', ['public']),
  row('c', 'active', ['home']),
];
test('facets OR values within a group and AND across groups', () => {
  const options = facetOptions(rows);
  const selected = options
    .filter((x) => x.group === '状态' || x.value === 'public')
    .map((x) => x.key);
  assert.deepEqual(
    applyFacets(rows, options, new Set(selected)).map((x) => x.id),
    ['a', 'b'],
  );
  assert.equal(applyFacets(rows, options, new Set()).length, 3);
});
test('selected object path is public UI context, not its private destination', () => {
  assert.equal(
    objectPath('/tools/hosts', 'iStoreOS 旁路由 VM'),
    '~/tools/hosts/istoreos-旁路由-vm',
  );
  assert.equal(objectPath('/tools/hosts'), '~/tools/hosts');
});
