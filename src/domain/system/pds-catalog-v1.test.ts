import assert from 'node:assert/strict';
import test from 'node:test';
import catalogData from '../../data/system/pds-catalog-v1.json';
import { parsePdsCatalogV1 } from './pds-catalog-v1';

test('tracked pds-catalog-v1 is a valid thin system catalog projection', () => {
  const catalog = parsePdsCatalogV1(JSON.stringify(catalogData));
  assert.equal(catalog.product, 'pds-catalog-v1');
  assert.ok(catalog.payload.summary.domainCount >= 6);
  assert.ok(catalog.payload.summary.repositoryCount >= 10);
  assert.ok(catalog.payload.domains.some((domain) => domain.id === 'infrastructure'));
  assert.ok(catalog.payload.domains.some((domain) => domain.id === 'presentation'));
  assert.ok(catalog.payload.repositories.some((repository) => repository.id === 'digital-biome'));
});

test('pds-catalog-v1 accepts safe repository navigation metadata and rejects unsafe URLs', () => {
  const enriched = structuredClone(catalogData) as any;
  enriched.payload.domains[0].repositories[0].webUrl =
    'https://github.com/BakerSean168/agent-harness';
  enriched.payload.domains[0].repositories[0].lifecycle = 'active';
  enriched.payload.domains[0].repositories[0].metadataState = 'present';
  enriched.payload.repositories[0].webUrl = 'https://github.com/BakerSean168/agent-harness';
  enriched.payload.repositories[0].lifecycle = 'active';
  enriched.payload.repositories[0].metadataState = 'present';

  const parsed = parsePdsCatalogV1(JSON.stringify(enriched));
  assert.equal(
    parsed.payload.domains[0]?.repositories[0]?.webUrl,
    'https://github.com/BakerSean168/agent-harness',
  );

  enriched.payload.repositories[0].webUrl = 'javascript:alert(1)';
  assert.throws(() => parsePdsCatalogV1(JSON.stringify(enriched)), /webUrl is invalid/);
});
