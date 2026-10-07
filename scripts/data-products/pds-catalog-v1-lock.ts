import fs from 'node:fs';
import { parsePdsCatalogV1 } from '../../src/domain/system/pds-catalog-v1';
import { parsePublicDataProductLock } from './lock-v1';
import { semanticSha256, sha256 } from './semantic-digest';

export function parsePdsCatalogV1Lock(raw: string) {
  const lock = parsePublicDataProductLock(JSON.parse(raw));
  if (lock.product !== 'pds-catalog-v1') throw new Error('Expected pds-catalog-v1 lock');
  return lock;
}

export function loadPdsCatalogV1Lock(file = 'data-products/pds-catalog-v1.lock.json') {
  return parsePdsCatalogV1Lock(fs.readFileSync(file, 'utf8'));
}

/** Local read-model check only; prepare owns exact Release/manifest verification. */
export function verifyMaterializedPdsCatalogV1(
  lockFile = 'data-products/pds-catalog-v1.lock.json',
  artifactFile = 'src/data/system/pds-catalog-v1.json',
): void {
  const lock = loadPdsCatalogV1Lock(lockFile);
  const bytes = fs.readFileSync(artifactFile);
  if (sha256(bytes) !== lock.artifact.sha256)
    throw new Error('pds-catalog-v1 artifact digest mismatch');
  const catalog = parsePdsCatalogV1(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (catalog.source.revision !== lock.sourceRevision)
    throw new Error('pds-catalog-v1 source revision mismatch');
  if (semanticSha256(catalog) !== lock.semanticSha256)
    throw new Error('pds-catalog-v1 semantic digest mismatch');
}
