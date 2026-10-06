import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTerminalCatalogBoundary } from './terminal-catalog-boundary';
const catalog = ['a', 'b', 'c'].map((id) => ({
  id,
  title: id,
  href: `/notes/${id}`,
  kind: 'note',
  description: '',
  meta: '',
  tags: [],
  relations: [],
}));
test('SSR must not embed deferred rows or reorder the catalog', () => {
  const row = (id: string) => `<a data-terminal-kind="note" data-terminal-id="${id}">`;
  assert.doesNotThrow(() => assertTerminalCatalogBoundary(row('a') + row('b'), catalog, 'note', 2));
  assert.throws(() =>
    assertTerminalCatalogBoundary(row('a') + row('b') + row('c'), catalog, 'note', 2),
  );
  assert.throws(() => assertTerminalCatalogBoundary(row('b') + row('a'), catalog, 'note', 2));
});
