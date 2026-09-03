import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  toNoteId,
  noteIdToRelativePath,
  relativePathToNoteId,
  noteIdToBasename,
  isAssetNoteId,
  toRouteSlug,
} from './note-id';

describe('toNoteId', () => {
  test('adds the obsidian prefix and strips the md extension', () => {
    assert.equal(toNoteId('vue-computed.md'), 'obsidian/vue-computed');
    assert.equal(toNoteId('assets/services/site.md'), 'obsidian/assets/services/site');
  });

  test('keeps paths without an extension unchanged', () => {
    assert.equal(toNoteId('z/foo'), 'obsidian/z/foo');
  });
});

describe('note id to path conversions', () => {
  test('noteIdToRelativePath strips only the obsidian prefix', () => {
    assert.equal(noteIdToRelativePath('obsidian/vue-computed'), 'vue-computed');
    assert.equal(noteIdToRelativePath('other/prefix'), 'other/prefix');
  });

  test('relativePathToNoteId is an alias for toNoteId', () => {
    assert.equal(relativePathToNoteId('foo.md'), 'obsidian/foo');
  });
});

describe('note id helpers', () => {
  test('noteIdToBasename returns the last path segment', () => {
    assert.equal(noteIdToBasename('obsidian/a/b/c'), 'c');
    assert.equal(noteIdToBasename('obsidian/solo'), 'solo');
  });

  test('isAssetNoteId matches only the assets path prefix', () => {
    assert.equal(isAssetNoteId('obsidian/assets/services/svc'), true);
    assert.equal(isAssetNoteId('obsidian/notes'), false);
    assert.equal(isAssetNoteId('assets/notes'), false);
  });

  test('toRouteSlug preserves the obsidian prefix and strips legacy locale prefixes', () => {
    assert.equal(toRouteSlug('obsidian/vue-computed'), 'obsidian/vue-computed');
    assert.equal(toRouteSlug('zh/obsidian/vue'), 'obsidian/vue');
    assert.equal(toRouteSlug('en/obsidian/vue'), 'obsidian/vue');
  });
});
