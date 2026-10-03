import assert from 'node:assert/strict';
import test from 'node:test';
import type { PdsCatalogDomain } from '../domain/system/pds-catalog-v1';
import {
  ownerSystemDomains,
  personalSystemAccessTier,
  publicSystemDomains,
  visibleSystemDomains,
} from './personal-systems-access';

const fixture = (id: string): PdsCatalogDomain => ({ id, name: id, repositories: [] });

test('personal system access policy fails closed for newly catalogued domains', () => {
  assert.equal(personalSystemAccessTier('future-private-system'), 'owner');
});

test('public and owner catalog slices are explicit', () => {
  const domains = [fixture('knowledge'), fixture('products'), fixture('future-private-system')];
  assert.deepEqual(
    publicSystemDomains(domains).map((domain) => domain.id),
    ['knowledge'],
  );
  assert.deepEqual(
    ownerSystemDomains(domains).map((domain) => domain.id),
    ['products', 'future-private-system'],
  );
  assert.deepEqual(
    visibleSystemDomains(domains).map((domain) => domain.id),
    ['knowledge', 'products', 'future-private-system'],
  );
});
