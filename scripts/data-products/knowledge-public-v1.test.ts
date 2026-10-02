import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  knowledgeProjectionSummary,
  knowledgePublicIds,
  materializeKnowledgePublicV1Source,
  parseKnowledgePublicV1,
  type KnowledgePublicV1,
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
