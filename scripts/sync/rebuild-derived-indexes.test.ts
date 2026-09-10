import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildAssetIndex, buildTagIndex, rebuildDerivedIndexes } from './rebuild-derived-indexes';

const notes = {
  version: 1,
  generatedAt: '2026-09-10T00:00:00.000Z',
  entries: [
    { id: 'obsidian/public', tags: ['type/concept', 'shared'], visibility: 'public' as const, isAsset: false },
    { id: 'obsidian/private', tags: ['private-only', 'shared'], visibility: 'private' as const, isAsset: false },
    {
      id: 'obsidian/assets/tool',
      title: 'Canonical Tool',
      tags: ['type/asset', 'shared'],
      visibility: 'public' as const,
      isAsset: true,
      asset_id: 'tool-example',
      asset_type: 'tool',
      type: 'asset',
      status: 'active',
    },
  ],
};

test('derives public tag counts from the reconciled notes snapshot', () => {
  const result = buildTagIndex(notes);
  assert.deepEqual(result.tags, [
    { tag: 'shared', count: 2 },
    { tag: 'type/concept', count: 1 },
    { tag: 'type/asset', count: 1 },
  ]);
  assert.equal(result.generatedAt, notes.generatedAt);
});

test('derives asset metadata from the same reconciled note entries', () => {
  const result = buildAssetIndex(notes);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].id, 'obsidian/assets/tool');
  assert.equal(result.entries[0].type, 'asset');
  assert.equal(result.entries[0].status, 'active');
});

test('rewrites derived index files from notes-index.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'digital-biome-derived-indexes-'));
  fs.writeFileSync(path.join(root, 'notes-index.json'), JSON.stringify(notes));
  fs.writeFileSync(path.join(root, 'tag-index.json'), JSON.stringify({ stale: true }));
  fs.writeFileSync(path.join(root, 'asset-index.json'), JSON.stringify({ stale: true }));

  rebuildDerivedIndexes(root);

  const tags = JSON.parse(fs.readFileSync(path.join(root, 'tag-index.json'), 'utf8'));
  const assets = JSON.parse(fs.readFileSync(path.join(root, 'asset-index.json'), 'utf8'));
  assert.equal(tags.tags.find((entry: { tag: string }) => entry.tag === 'private-only'), undefined);
  assert.equal(assets.entries[0].title, 'Canonical Tool');
});
