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
