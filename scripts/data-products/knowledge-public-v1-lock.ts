import { parseKnowledgePublicV1, type KnowledgePublicV1 } from './knowledge-public-v1';
import { parsePublicDataProductLock, type PublicDataProductLock } from './lock-v1';
import { getPublicDataProduct } from './registry';
import { semanticSha256, sha256 } from './semantic-digest';
import { verifyManifest } from './verify-publication';

export const KNOWLEDGE_PUBLIC_V1_PRODUCER = 'BakerSean168/thought-forest';

export type KnowledgePublicV1Lock = PublicDataProductLock & {
  product: 'knowledge-public-v1';
  producerRepository: typeof KNOWLEDGE_PUBLIC_V1_PRODUCER;
  artifact: { name: 'knowledge-public-v1.json'; sha256: string };
  manifest: { name: 'knowledge-public-v1.manifest.json'; sha256: string };
};

export function parseKnowledgePublicV1Lock(raw: string): KnowledgePublicV1Lock {
  const lock = parsePublicDataProductLock(JSON.parse(raw));
  if (lock.product !== 'knowledge-public-v1') throw new Error('Expected knowledge-public-v1 lock');
  // Common parser has already bound the product to its repository and exact asset names.
  return lock as KnowledgePublicV1Lock;
}

export function verifyKnowledgePublicV1Artifact(
  lock: KnowledgePublicV1Lock,
  raw: string,
): KnowledgePublicV1 {
  const actualDigest = sha256(Buffer.from(raw));
  if (actualDigest !== lock.artifact.sha256) {
    throw new Error(
      `knowledge-public-v1 artifact digest mismatch: expected ${lock.artifact.sha256}, got ${actualDigest}`,
    );
  }
  const projection = parseKnowledgePublicV1(raw);
  if (projection.source.revision !== lock.sourceRevision) {
    throw new Error(
      `knowledge-public-v1 source revision mismatch: lock ${lock.sourceRevision}, artifact ${projection.source.revision}`,
    );
  }
  if (semanticSha256(projection) !== lock.semanticSha256)
    throw new Error('knowledge-public-v1 semantic digest mismatch');
  return projection;
}

export function verifyKnowledgePublicV1Manifest(lock: KnowledgePublicV1Lock, raw: string): void {
  const actualDigest = sha256(Buffer.from(raw));
  if (actualDigest !== lock.manifest.sha256) {
    throw new Error(
      `knowledge-public-v1 manifest digest mismatch: expected ${lock.manifest.sha256}, got ${actualDigest}`,
    );
  }
  verifyManifest(
    JSON.parse(raw),
    lock,
    getPublicDataProduct('knowledge-public-v1', KNOWLEDGE_PUBLIC_V1_PRODUCER),
  );
}
