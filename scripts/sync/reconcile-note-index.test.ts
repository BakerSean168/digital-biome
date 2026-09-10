import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  reconcileNote,
  reconcileNoteIndex,
  toUpstreamSourcePath,
} from './reconcile-note-index';

test('maps published destinations back to their Thought Forest source namespaces', () => {
  assert.equal(toUpstreamSourcePath('typescript.md'), 'z/typescript.md');
  assert.equal(toUpstreamSourcePath('nested/topic.md'), 'z/nested/topic.md');
  assert.equal(toUpstreamSourcePath('assets/services/example.md'), 'assets/services/example.md');
  assert.equal(toUpstreamSourcePath('config/skills/example.md'), 'config/skills/example.md');
  assert.equal(toUpstreamSourcePath('blogs/example.md'), null);
  assert.equal(toUpstreamSourcePath('../escape.md'), null);
});

test('takes rich parsed metadata upstream while preserving Digital Biome route and privacy fields', () => {
  const local = {
    id: 'obsidian/assets/subscriptions/example',
    filePath: 'assets/subscriptions/example.md',
    title: ' Example ',
    description: 'broken \\"quote',
    tags: ['type/asset'],
    aliases: ['one, two'],
    type: 'note',
    status: undefined,
    visibility: 'private' as const,
    private: false,
    draft: false,
    created: '2026-09-10T00:00:00.000Z',
    url: 'https://example.com',
  };
  const result = reconcileNote(local, {
    sourcePath: 'assets/subscriptions/example.md',
    title: 'Example',
    description: 'safe "quote"',
    tags: ['type/asset', 'status/active'],
    aliases: ['one', 'two'],
    noteType: 'asset',
    status: 'active',
    visibility: 'public',
  });

  assert.equal(result.id, local.id);
  assert.equal(result.filePath, local.filePath);
  assert.equal(result.visibility, 'private');
  assert.equal(result.created, local.created);
  assert.equal(result.url, local.url);
  assert.equal(result.title, 'Example');
  assert.equal(result.description, 'safe "quote"');
  assert.deepEqual(result.aliases, ['one', 'two']);
  assert.deepEqual(result.tags, ['type/asset', 'status/active']);
  assert.equal(result.type, 'asset');
  assert.equal(result.status, 'active');
});

test('reconciles matching upstream notes and leaves blogs/local-only entries untouched', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'digital-biome-index-'));
  const upstreamDir = path.join(root, 'upstream');
  const localDir = path.join(root, 'local');
  fs.mkdirSync(upstreamDir);
  fs.mkdirSync(localDir);
  fs.writeFileSync(path.join(upstreamDir, 'notes-index.json'), JSON.stringify([{
    sourcePath: 'z/a.md',
    title: 'Canonical A',
    tags: ['type/concept', 'status/growing'],
    aliases: ['A'],
    noteType: 'concept',
    status: 'growing',
    visibility: 'public',
  }]));
  fs.writeFileSync(path.join(localDir, 'notes-index.json'), JSON.stringify({
    version: 1,
    generatedAt: 'before',
    entries: [
      { id: 'obsidian/a', filePath: 'a.md', title: 'A', tags: [], aliases: [], type: 'note', visibility: 'public' },
      { id: 'obsidian/blogs/post', filePath: 'blogs/post.md', title: 'Post', tags: [], aliases: [], type: 'blog', visibility: 'public' },
    ],
  }));

  reconcileNoteIndex(upstreamDir, localDir);
  const output = JSON.parse(fs.readFileSync(path.join(localDir, 'notes-index.json'), 'utf8'));
  assert.equal(output.entries[0].title, 'Canonical A');
  assert.equal(output.entries[0].status, 'growing');
  assert.equal(output.entries[1].title, 'Post');
  assert.equal(output.entries[1].type, 'blog');
});
