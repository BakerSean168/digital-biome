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


test('derived tag and asset indexes stay aligned with the reconciled notes snapshot', () => {
  const notes = JSON.parse(fs.readFileSync(localPath, 'utf8')).entries as LocalNote[];
  const tags = JSON.parse(
    fs.readFileSync(path.resolve('src/data/indexes/tag-index.json'), 'utf8'),
  ).tags as Array<{ tag: string; count: number }>;
  const assets = JSON.parse(
    fs.readFileSync(path.resolve('src/data/indexes/asset-index.json'), 'utf8'),
  ).entries as Array<LocalNote & { isAsset: boolean }>;

  const expectedTagCounts = new Map<string, number>();
  for (const note of notes) {
    if (note.visibility !== 'public') continue;
    for (const tag of note.tags) {
      expectedTagCounts.set(tag, (expectedTagCounts.get(tag) ?? 0) + 1);
    }
  }
  assert.deepEqual(
    new Map(tags.map(entry => [entry.tag, entry.count])),
    expectedTagCounts,
    'tag-index must derive from final reconciled public notes',
  );

  const notesById = new Map(notes.map(note => [note.id, note]));
  const metadataFields = ['title', 'description', 'tags', 'aliases', 'type', 'status', 'visibility'] as const;
  for (const asset of assets) {
    const note = notesById.get(asset.id);
    assert.ok(note, `${asset.id}: asset must exist in notes-index`);
    for (const field of metadataFields) {
      assert.deepEqual(asset[field], note[field], `${asset.id}: ${field} drift`);
    }
  }
});
