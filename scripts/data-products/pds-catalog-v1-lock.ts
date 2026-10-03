import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parsePdsCatalogV1 } from '../../src/domain/system/pds-catalog-v1';

export interface PdsCatalogV1Lock {
  product: 'pds-catalog-v1';
  producerRepository: 'BakerSean168/personal-digital-system';
  sourceRevision: string;
  artifact: {
    path: 'generated/pds-catalog-v1.json';
    sha256: string;
  };
}

function sha256(raw: string): string {
  return `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;
}

export function loadPdsCatalogV1Lock(
  file = 'data-products/pds-catalog-v1.lock.json',
): PdsCatalogV1Lock {
  const value = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) as PdsCatalogV1Lock;
  if (
    value.product !== 'pds-catalog-v1' ||
    value.producerRepository !== 'BakerSean168/personal-digital-system' ||
    !/^[0-9a-f]{40}$/.test(value.sourceRevision) ||
    value.artifact?.path !== 'generated/pds-catalog-v1.json' ||
    !/^sha256:[0-9a-f]{64}$/.test(value.artifact?.sha256 ?? '')
  ) {
    throw new Error('pds-catalog-v1 lock is invalid');
  }
  return value;
}

export function verifyTrackedPdsCatalogV1(
  lockFile = 'data-products/pds-catalog-v1.lock.json',
  artifactFile = 'src/data/system/pds-catalog-v1.json',
): void {
  const lock = loadPdsCatalogV1Lock(lockFile);
  const raw = fs.readFileSync(path.resolve(artifactFile), 'utf8');
  if (sha256(raw) !== lock.artifact.sha256) {
    throw new Error('pds-catalog-v1 artifact digest mismatch');
  }
  const catalog = parsePdsCatalogV1(raw);
  if (catalog.source.revision !== lock.sourceRevision) {
    throw new Error('pds-catalog-v1 source revision mismatch');
  }
}
