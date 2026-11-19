import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeUsesServices } from './uses-services';
import type { NoteIndexEntry } from '../types/knowledge-index';
import type { TerminalObject } from '../view-models/terminal-object';

const resource: TerminalObject = {
  id: 'service-reader',
  kind: 'service',
  title: 'Reader',
  description: 'Registration',
  href: '/login?next=%2Fuses',
  privateRef: 'service-reader.entry',
  meta: 'Registered',
  tags: [],
  relations: [],
};
const card: NoteIndexEntry = {
  id: 'obsidian/uses/services/reader',
  filePath: 'uses/services/reader.md',
  title: 'My reader',
  description: 'My workflow',
  visibility: 'public',
  status: 'active',
  tags: [],
  aliases: [],
  type: 'resource',
  isAsset: false,
  draft: false,
  private: false,
};

test('service records associate only by exact public upstream ID, preserving Access and registration facts', () => {
  const separate = mergeUsesServices(
    [resource],
    [{ ...card, title: 'Reader', url: resource.href }],
  );
  assert.equal(separate.length, 2, 'matching names and destinations never imply identity');
  const [merged] = mergeUsesServices([resource], [{ ...card, infraResourceId: resource.id }]);
  assert.equal(merged.title, card.title);
  assert.equal(merged.description, card.description);
  assert.equal(merged.href, resource.href);
  assert.equal(merged.privateRef, resource.privateRef);
  assert.equal(merged.meta, resource.meta);
  assert.equal(merged.relations[0].href, '/notes/obsidian/uses/services/reader');
  assert.equal(resource.title, 'Reader', 'input registry is immutable');
  assert.throws(
    () => mergeUsesServices([resource], [{ ...card, infraResourceId: 'missing' }]),
    /Unknown/,
  );
  assert.throws(
    () =>
      mergeUsesServices(
        [resource],
        [card, card].map((item) => ({ ...item, infraResourceId: resource.id })),
      ),
    /duplicate/,
  );
  assert.deepEqual(mergeUsesServices([resource], [{ ...card, status: 'sold' }]), [resource]);
});
