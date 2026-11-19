import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildIndexes } from '../sync/build-indexes';
import {
  type KnowledgePublicV1,
  knowledgeProjectionSummary,
  knowledgePublicIds,
  materializeKnowledgePublicV1Source,
  parseKnowledgePublicV1,
} from './knowledge-public-v1';

function fixture(): KnowledgePublicV1 {
  return {
    schemaVersion: 1,
    product: 'knowledge-public-v1',
    generated: true,
    editable: false,
    producer: 'pds://system/component/thought-forest',
    source: {
      repository: 'https://github.com/BakerSean168/thought-forest.git',
      revision: 'abcdef1234567890abcdef1234567890abcdef12',
    },
    payload: {
      notes: [
        {
          id: 'obsidian/example',
          collection: 'knowledge',
          sourcePath: 'z/example.md',
          slug: 'example',
          title: 'Example',
          aliases: [],
          url: 'https://example.com/tool',
          icon: 'example',
          category: 'demo',
          tags: ['demo'],
          visibility: 'public',
          isAsset: false,
          isMoc: false,
          markdown: '# Example\n',
        },
      ],
      assets: [],
      tags: [{ tag: 'demo', count: 1, samplePaths: ['z/example.md'] }],
      linkGraph: [{ sourceId: 'obsidian/example', outgoing: [], backlinks: [] }],
      media: [],
    },
  };
}

test('resource priority reaches materialized Markdown and the local note index', () => {
  const value = fixture();
  value.payload.notes[0].usagePriority = 1;
  value.payload.notes[0].markdown =
    '---\ntitle: Example\ntags: [type/resource]\nusage_priority: 1\nurl: https://example.com\n---\nExample\n';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-priority-consumer-'));
  try {
    const source = materializeKnowledgePublicV1Source(
      parseKnowledgePublicV1(JSON.stringify(value)),
      path.join(root, 'source'),
    );
    const index = JSON.parse(
      fs.readFileSync(
        path.join(source.sourceRoot, 'generated/knowledge-index/notes-index.json'),
        'utf8',
      ),
    );
    assert.equal(index[0].usagePriority, 1);
    assert.match(
      fs.readFileSync(path.join(source.sourceRoot, 'z/example.md'), 'utf8'),
      /usage_priority: 1/,
    );
    const output = path.join(root, 'local-index');
    buildIndexes(path.join(source.sourceRoot, 'z'), output);
    const local = JSON.parse(fs.readFileSync(path.join(output, 'notes-index.json'), 'utf8'));
    assert.equal(local.entries[0].usagePriority, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  for (const invalid of [0, -1, 1.5, '1', true]) {
    Object.assign(value.payload.notes[0], { usagePriority: invalid });
    assert.throws(() => parseKnowledgePublicV1(JSON.stringify(value)), /usagePriority/);
  }
});

test('accepts the producer-owned public projection envelope', () => {
  const projection = parseKnowledgePublicV1(JSON.stringify(fixture()));
  assert.deepEqual(knowledgeProjectionSummary(projection), {
    sourceRevision: 'abcdef1234567890abcdef1234567890abcdef12',
    notes: 1,
    assets: 0,
    tags: 1,
    links: 1,
    media: 0,
  });
  assert.deepEqual([...knowledgePublicIds(projection)], ['obsidian/example']);
});

test('fails closed on contract identity or publication-boundary drift', () => {
  const wrongProduct = fixture();
  wrongProduct.product = 'knowledge-private-v1';
  assert.throws(() => parseKnowledgePublicV1(JSON.stringify(wrongProduct)), /envelope mismatch/);

  const nonPublic = fixture();
  nonPublic.payload.notes[0].visibility = 'internal';
  assert.throws(() => parseKnowledgePublicV1(JSON.stringify(nonPublic)), /invalid public note/);

  const wrongRepository = fixture();
  wrongRepository.source.repository = 'https://example.invalid/public.git';
  assert.throws(
    () => parseKnowledgePublicV1(JSON.stringify(wrongRepository)),
    /source provenance is invalid/,
  );

  const unsafeUrl = fixture();
  unsafeUrl.payload.notes[0].url = 'ssh://private-host';
  assert.throws(
    () => parseKnowledgePublicV1(JSON.stringify(unsafeUrl)),
    /url must be public HTTP\(S\)/,
  );
});

test('retrospective blog archive month survives the public projection and site index', () => {
  const value = fixture();
  const note = value.payload.notes[0];
  note.id = 'blog/reflection';
  note.collection = 'blog';
  note.sourcePath = 'blogs/reflection.md';
  note.slug = 'reflection';
  note.archiveMonth = '2026-05';
  note.created = '2026-10-16T15:05:00+08:00';
  note.updated = '2026-10-16T16:07:00+08:00';
  note.markdown =
    '---\ntitle: Reflection\narchive_month: "2026-05"\ncreated: 2026-10-16T15:05:00+08:00\nupdated: 2026-10-16T16:07:00+08:00\n---\nPersonal note.\n';
  value.payload.linkGraph[0].sourceId = note.id;
  assert.equal(
    parseKnowledgePublicV1(JSON.stringify(value)).payload.notes[0].archiveMonth,
    '2026-05',
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-blog-month-consumer-'));
  try {
    const materialized = materializeKnowledgePublicV1Source(value, path.join(root, 'source'));
    const output = path.join(root, 'local-index');
    buildIndexes(path.join(materialized.sourceRoot, 'blogs'), output);
    const index = JSON.parse(fs.readFileSync(path.join(output, 'notes-index.json'), 'utf8'));
    assert.equal(index.entries[0].archiveMonth, '2026-05');
    assert.equal(new Date(index.entries[0].created).toISOString(), '2026-10-16T07:05:00.000Z');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  note.archiveMonth = '2026-13';
  assert.throws(() => parseKnowledgePublicV1(JSON.stringify(value)), /archiveMonth/);
  note.archiveMonth = '2026-05';
  note.collection = 'knowledge';
  assert.throws(() => parseKnowledgePublicV1(JSON.stringify(value)), /archiveMonth/);
});

test('materializes a projection as an isolated legacy-compatible sync source', () => {
  const value = fixture();
  const media = Buffer.from('public-image');
  value.payload.media.push({
    path: 'example.png',
    mediaType: 'image/png',
    sha256: crypto.createHash('sha256').update(media).digest('hex'),
    dataBase64: media.toString('base64'),
  });

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-public-v1-consumer-'));
  const sourceRoot = path.join(root, 'source');
  try {
    const projection = parseKnowledgePublicV1(JSON.stringify(value));
    const result = materializeKnowledgePublicV1Source(projection, sourceRoot);

    assert.equal(result.sourceRevision, projection.source.revision);
    assert.equal(fs.readFileSync(path.join(sourceRoot, 'z', 'example.md'), 'utf8'), '# Example\n');
    const noteIndex = JSON.parse(
      fs.readFileSync(
        path.join(sourceRoot, 'generated', 'knowledge-index', 'notes-index.json'),
        'utf8',
      ),
    ) as Array<{ id: string }>;
    assert.deepEqual(
      noteIndex.map((entry) => entry.id),
      ['obsidian/example'],
    );
    assert.deepEqual(
      fs.readFileSync(path.join(sourceRoot, 'sources', 'attachments', 'example.png')),
      media,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed when materialized media bytes do not match producer digest', () => {
  const value = fixture();
  value.payload.media.push({
    path: 'example.png',
    mediaType: 'image/png',
    sha256: '0'.repeat(64),
    dataBase64: Buffer.from('tampered').toString('base64'),
  });

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-public-v1-digest-'));
  try {
    const projection = parseKnowledgePublicV1(JSON.stringify(value));
    assert.throws(
      () => materializeKnowledgePublicV1Source(projection, path.join(root, 'source')),
      /media digest mismatch/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


test('relocated notes and public singleton pages materialize without changing stable note IDs', () => {
  const projection = fixture();
  projection.payload.notes[0].sourcePath = 'notes/example.md';
  projection.payload.notes.push({
    id: 'obsidian/pages/about',
    collection: 'page',
    sourcePath: 'pages/about.md',
    slug: 'about',
    title: 'BakerSean',
    aliases: ['关于我'],
    tags: ['type/synthesis'],
    visibility: 'public',
    updated: '2026-11-19T00:00:00',
    isAsset: false,
    isMoc: false,
    markdown: '---\ntitle: BakerSean\ndraft: false\nvisibility: public\nupdated: 2026-11-19T00:00:00\n---\n\n## 一节\n^about-practice\n\n正文。\n',
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-site-page-consumer-'));
  try {
    const source = materializeKnowledgePublicV1Source(
      parseKnowledgePublicV1(JSON.stringify(projection)),
      path.join(root, 'source'),
    );
    assert.equal(fs.existsSync(path.join(source.sourceRoot, 'z')), false);
    assert.equal(fs.existsSync(path.join(source.sourceRoot, 'notes/example.md')), true);
    assert.match(fs.readFileSync(path.join(source.sourceRoot, 'pages/about.md'), 'utf8'), /## 一节/);
    const index = JSON.parse(
      fs.readFileSync(path.join(source.sourceRoot, 'generated/knowledge-index/notes-index.json'), 'utf8'),
    ) as Array<{ id: string; sourcePath: string; collection?: string }>;
    assert.deepEqual(
      index.map((entry) => entry.id),
      ['obsidian/example', 'obsidian/pages/about'],
    );
    assert.equal(index[0].sourcePath, 'notes/example.md');
    assert.equal(index[1].sourcePath, 'pages/about.md');
    const output = path.join(root, 'local-index');
    buildIndexes(path.join(source.sourceRoot, 'notes'), output);
    const consumerIndex = JSON.parse(fs.readFileSync(path.join(output, 'notes-index.json'), 'utf8'));
    assert.deepEqual(consumerIndex.entries.map((entry: { id: string }) => entry.id), ['obsidian/example']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
