import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { inferVisibility } from './visibility';

describe('inferVisibility', () => {
  test('defaults knowledge notes to public', () => {
    assert.equal(inferVisibility({}), 'public');
    assert.equal(inferVisibility({ draft: false, private: false, visibility: null }), 'public');
  });

  test('draft notes are private regardless of other fields', () => {
    assert.equal(inferVisibility({ draft: true }), 'private');
    assert.equal(inferVisibility({ draft: true, visibility: 'public' }), 'private');
    assert.equal(inferVisibility({ draft: true, visibility: 'internal' }), 'private');
  });

  test('private flag is private regardless of visibility field', () => {
    assert.equal(inferVisibility({ private: true }), 'private');
    assert.equal(inferVisibility({ private: true, visibility: 'public' }), 'private');
  });

  test('explicit private and internal visibility are honored', () => {
    assert.equal(inferVisibility({ visibility: 'private' }), 'private');
    assert.equal(inferVisibility({ visibility: 'internal' }), 'internal');
  });

  test('asset notes require explicit public visibility', () => {
    assert.equal(inferVisibility({ isAsset: true }), 'private');
    assert.equal(inferVisibility({ isAsset: true, visibility: 'internal' }), 'internal');
    assert.equal(inferVisibility({ isAsset: true, visibility: 'public' }), 'public');
    assert.equal(inferVisibility({ isAsset: true, draft: true, visibility: 'public' }), 'private');
  });
});
