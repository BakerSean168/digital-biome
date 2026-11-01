import assert from 'node:assert/strict';
import test from 'node:test';
import { createTerminalBrowserState, visibleTerminalItems } from './terminal-browser-state';
import type { TerminalObject } from '../view-models/terminal-object';

function mockRow(id: string): HTMLAnchorElement {
  return {
    dataset: {
      object: JSON.stringify({
        id,
        kind: 'external',
        title: id,
        href: '/tools',
        description: id,
        meta: '',
        tags: [],
        relations: [],
      }),
    },
    querySelector: (selector: string) =>
      selector === '[data-object-title]' ? { textContent: id } : null,
  } as unknown as HTMLAnchorElement;
}

test('state belongs to one root and starts with its own SSR rows and deferred-catalog flag', () => {
  const first = createTerminalBrowserState([mockRow('one')], '/data/terminal/notes.json');
  const second = createTerminalBrowserState([mockRow('two')], undefined);
  assert.equal(first.items[0].id, 'one');
  assert.equal(second.items[0].id, 'two');
  assert.equal(first.loaded, false);
  assert.equal(second.loaded, true);
  first.selected = 5;
  first.generation += 1;
  assert.equal(second.selected, 0);
  assert.equal(second.generation, 0);
  assert.equal(first.limit, 1);
  assert.equal(second.limit, 1);
});

test('pure sort/filter projection does not mutate shared catalog input or another selection', () => {
  const items = [
    {
      id: 'z',
      title: 'Zebra',
      kind: 'external',
      href: '/z',
      tags: [],
      description: '',
      meta: '',
      relations: [],
    },
    {
      id: 'a',
      title: 'Alpha',
      kind: 'external',
      href: '/a',
      tags: [],
      description: '',
      meta: '',
      relations: [],
    },
  ] as TerminalObject[];
  const result = visibleTerminalItems(items, '', [], new Set(), 'title');
  assert.deepEqual(
    result.map((item) => item.id),
    ['a', 'z'],
  );
  assert.deepEqual(
    items.map((item) => item.id),
    ['z', 'a'],
  );
  assert.deepEqual(
    visibleTerminalItems(items, 'zebra', [], new Set(), 'default').map((item) => item.id),
    ['z'],
  );
});
