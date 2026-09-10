import assert from 'node:assert/strict';
import test from 'node:test';
import type { NotesIndex } from '../src/types/knowledge-index';
import { buildFunctionRouteManifest } from './private-function-routes';

function fixture(entries: NotesIndex['entries']): NotesIndex {
  return { version: 1, generatedAt: '2026-09-10T00:00:00.000Z', entries };
}

const base = {
  title: 'fixture',
  tags: [],
  aliases: [],
  draft: false,
  private: false,
  visibility: 'public' as const,
  type: 'note',
  isAsset: false,
  filePath: 'fixture.md',
};

test('routes only API and protected notes through Pages Functions', () => {
  const manifest = buildFunctionRouteManifest(fixture([
    { ...base, id: 'obsidian/public-note' },
    { ...base, id: 'obsidian/private-note', private: true, visibility: 'private' },
    { ...base, id: 'obsidian/draft-note', draft: true },
    { ...base, id: 'obsidian/assets/private-host', isAsset: true, private: true, visibility: 'private' },
  ]));

  assert.deepEqual(manifest, {
    version: 1,
    include: [
      '/api/*',
      '/notes/obsidian/draft-note*',
      '/notes/obsidian/private-note*',
    ],
    exclude: [],
  });
});

test('fails closed if a protected wildcard could shadow a public note', () => {
  assert.throws(() => buildFunctionRouteManifest(fixture([
    { ...base, id: 'obsidian/topic', private: true, visibility: 'private' },
    { ...base, id: 'obsidian/topic-public' },
  ])), /would shadow a public route/);
});
