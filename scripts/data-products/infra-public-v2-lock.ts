import {
  parseInfraPublicV2,
  type InfraPublicV2,
} from '../../src/domain/infrastructure/infra-public-v2';
import { parsePublicDataProductLock, type PublicDataProductLock } from './lock-v1';
import { getPublicDataProduct } from './registry';
import { semanticSha256, sha256 } from './semantic-digest';
import { verifyManifest } from './verify-publication';

export const INFRA_PUBLIC_V2_PRODUCER = 'BakerSean168/personal-infrastructure';

export type InfraPublicV2Lock = PublicDataProductLock & {
  product: 'infra-public-v2';
  producerRepository: typeof INFRA_PUBLIC_V2_PRODUCER;
  artifact: { name: 'infra-public-v2.json'; sha256: string };
  manifest: { name: 'infra-public-v2.manifest.json'; sha256: string };
};

export function parseInfraPublicV2Lock(raw: string): InfraPublicV2Lock {
  const lock = parsePublicDataProductLock(JSON.parse(raw));
  if (lock.product !== 'infra-public-v2') throw new Error('Expected infra-public-v2 lock');
  // Common parser binds the product to its repository and exact asset names.
  return lock as InfraPublicV2Lock;
}

export function verifyInfraPublicV2Artifact(lock: InfraPublicV2Lock, raw: string): InfraPublicV2 {
  const actualDigest = sha256(Buffer.from(raw));
  if (actualDigest !== lock.artifact.sha256) {
    throw new Error(
      `infra-public-v2 artifact digest mismatch: expected ${lock.artifact.sha256}, got ${actualDigest}`,
    );
  }
  const projection = parseInfraPublicV2(raw);
  if (projection.source.revision !== lock.sourceRevision) {
    throw new Error(
      `infra-public-v2 source revision mismatch: lock ${lock.sourceRevision}, artifact ${projection.source.revision}`,
    );
  }
  if (semanticSha256(projection) !== lock.semanticSha256)
    throw new Error('infra-public-v2 semantic digest mismatch');
  return projection;
}

export function verifyInfraPublicV2Manifest(lock: InfraPublicV2Lock, raw: string): void {
  const actualDigest = sha256(Buffer.from(raw));
  if (actualDigest !== lock.manifest.sha256) {
    throw new Error(
      `infra-public-v2 manifest digest mismatch: expected ${lock.manifest.sha256}, got ${actualDigest}`,
    );
  }
  verifyManifest(
    JSON.parse(raw),
    lock,
    getPublicDataProduct('infra-public-v2', INFRA_PUBLIC_V2_PRODUCER),
  );
}
