import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { sanitizePublishedMetadataText, toUpstreamSourcePath } from './reconcile-note-index';

type LocalNote = {
  id: string;
  filePath: string;
  title: string;
  description?: string;
  tags: string[];
  aliases: string[];
  type: string;
  status?: string;
  visibility?: string;
};

type UpstreamNote = {
  sourcePath: string;
  title: string;
  description?: string;
  tags: string[];
  aliases: string[];
  noteType?: string;
  status?: string;
  visibility: string;
};

const localPath = path.resolve('src/data/indexes/notes-index.json');
const upstreamPath = path.resolve('thought-forest/generated/knowledge-index/notes-index.json');

function loadIndexes(): { local: LocalNote[]; upstream: UpstreamNote[] } {
  const local = JSON.parse(fs.readFileSync(localPath, 'utf8')).entries as LocalNote[];
  const upstream = JSON.parse(fs.readFileSync(upstreamPath, 'utf8')) as UpstreamNote[];
  return { local, upstream };
}

test('published note metadata agrees with the Thought Forest full-YAML authority', () => {
  const { local, upstream } = loadIndexes();
  const bySourcePath = new Map(upstream.map(note => [note.sourcePath, note]));
  let compared = 0;

  for (const note of local) {
    const sourcePath = toUpstreamSourcePath(note.filePath);
    if (!sourcePath) continue;
    const canonical = bySourcePath.get(sourcePath);
    if (!canonical) continue;
    compared += 1;

    assert.equal(note.title, sanitizePublishedMetadataText(canonical.title.trim()), `${sourcePath}: title drift`);
    assert.equal(note.description, canonical.description === undefined ? undefined : sanitizePublishedMetadataText(canonical.description), `${sourcePath}: description drift`);
    assert.deepEqual(note.tags, canonical.tags.map(value => sanitizePublishedMetadataText(value)), `${sourcePath}: tag drift`);
    assert.deepEqual(note.aliases, canonical.aliases.map(value => sanitizePublishedMetadataText(value)), `${sourcePath}: alias drift`);
    assert.equal(note.type, canonical.noteType ?? note.type, `${sourcePath}: note type drift`);
    assert.equal(note.status, canonical.status, `${sourcePath}: status drift`);
  }

  assert.ok(compared > 1000, `expected a populated authority comparison, got ${compared}`);
});

test('Digital Biome may make upstream-public assets stricter but never widens this shared set', () => {
  const { local, upstream } = loadIndexes();
  const bySourcePath = new Map(upstream.map(note => [note.sourcePath, note]));

  for (const note of local) {
    if (note.visibility !== 'public') continue;
    const sourcePath = toUpstreamSourcePath(note.filePath);
    if (!sourcePath) continue;
    const canonical = bySourcePath.get(sourcePath);
    if (!canonical) continue;
    assert.equal(canonical.visibility, 'public', `${sourcePath}: local publication widened upstream visibility`);
  }
});
