import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePdsCatalogV1Lock, verifyMaterializedPdsCatalogV1 } from './pds-catalog-v1-lock';
import { pdsReleaseFixture } from './fixtures/pds-release';
import { knowledgeReleaseFixture } from './fixtures/knowledge-release';

test('generated pds-catalog-v1 matches its Protocol-v1 producer lock', () => {
  verifyMaterializedPdsCatalogV1();
});

test('PDS lock adapter rejects legacy identity, foreign ownership, nullable and malformed values', () => {
  const f = pdsReleaseFixture();
  assert.deepEqual(parsePdsCatalogV1Lock(JSON.stringify(f.lock)), f.lock);
  for (const value of [
    null,
    knowledgeReleaseFixture().lock,
    { ...f.lock, manifest: null },
    { ...f.lock, semanticSha256: null },
    { ...f.lock, sourceRevision: 'main' },
    {
      ...f.lock,
      artifact: { path: 'generated/pds-catalog-v1.json', sha256: f.lock.artifact.sha256 },
    },
    {
      product: f.lock.product,
      producerRepository: f.lock.producerRepository,
      sourceRevision: f.lock.sourceRevision,
      artifact: f.lock.artifact,
    },
  ])
    assert.throws(() => parsePdsCatalogV1Lock(JSON.stringify(value)));
});
