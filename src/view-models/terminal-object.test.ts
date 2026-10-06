import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTerminalCatalog,
  filterTerminalObjects,
  type TerminalObject,
} from './terminal-object';
const service: TerminalObject = {
  id: 'svc-a',
  title: 'Sub-Store',
  kind: 'service',
  description: '订阅管理',
  meta: 'active',
  href: '/login?next=%2Ftools',
  privateRef: 'substore',
  tags: ['network/proxy'],
  relations: [{ title: 'Host', href: '/infrastructure/host-a' }],
};
test('catalog rejects executable URLs in destinations and relations', () => {
  assert.throws(() => parseTerminalCatalog([{ ...service, href: 'javascript:alert(1)' }]));
  assert.throws(() =>
    parseTerminalCatalog([
      { ...service, relations: [{ title: 'unsafe', href: '//evil.example' }] },
    ]),
  );
  assert.throws(() => parseTerminalCatalog([{ ...service, tags: [3] }]));
});
test('catalog rejects backslash navigation and embedded credentials', () => {
  assert.throws(() =>
    parseTerminalCatalog([{ ...service, href: '/' + String.fromCharCode(92) + 'evil.example' }]),
  );
  assert.throws(() =>
    parseTerminalCatalog([{ ...service, href: 'https://user:password@example.com' }]),
  );
});

test('locked service retains login destination and opaque reference', () => {
  const [item] = parseTerminalCatalog([service]);
  assert.equal(item.href, '/login?next=%2Ftools');
  assert.equal(item.privateRef, 'substore');
});
test('filter combines terms across title and hierarchical tags without mutating catalog', () => {
  assert.deepEqual(filterTerminalObjects([service], 'SUB proxy'), [service]);
  assert.deepEqual(filterTerminalObjects([service], 'sub missing'), []);
  assert.deepEqual(filterTerminalObjects([service], '   '), [service]);
});
