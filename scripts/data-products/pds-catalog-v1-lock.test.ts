import test from 'node:test';
import { verifyTrackedPdsCatalogV1 } from './pds-catalog-v1-lock';

test('tracked pds-catalog-v1 matches its producer lock', () => {
  verifyTrackedPdsCatalogV1();
});
