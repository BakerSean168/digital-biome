import crypto from 'node:crypto';
import { parseKnowledgePublicV1, type KnowledgePublicV1 } from './knowledge-public-v1';

export const KNOWLEDGE_PUBLIC_V1_PRODUCER = 'BakerSean168/thought-forest';

export type KnowledgePublicV1Lock = {
  schemaVersion: 1;
  product: 'knowledge-public-v1';
  producerRepository: typeof KNOWLEDGE_PUBLIC_V1_PRODUCER;
  sourceRevision: string;
  releaseTag: string;
  artifact: {
    name: 'knowledge-public-v1.json';
    sha256: string;
  };
  manifest: {
    name: 'knowledge-public-v1.manifest.json';
    sha256: string;
  };
};

const SHA_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(
      `${label} fields mismatch: expected ${wanted.join(', ')}; got ${actual.join(', ')}`,
    );
  }
}

function digest(raw: string): string {
  return `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;
}

export function parseKnowledgePublicV1Lock(raw: string): KnowledgePublicV1Lock {
  const value: unknown = JSON.parse(raw);
  assertRecord(value, 'knowledge-public-v1 lock');
  assertExactKeys(
    value,
    [
      'schemaVersion',
      'product',
      'producerRepository',
      'sourceRevision',
      'releaseTag',
      'artifact',
      'manifest',
    ],
    'knowledge-public-v1 lock',
  );

  if (
    value.schemaVersion !== 1 ||
    value.product !== 'knowledge-public-v1' ||
    value.producerRepository !== KNOWLEDGE_PUBLIC_V1_PRODUCER ||
    typeof value.sourceRevision !== 'string' ||
    !SHA_RE.test(value.sourceRevision) ||
    value.releaseTag !== `knowledge-public-v1-${value.sourceRevision}`
  ) {
    throw new Error('knowledge-public-v1 lock identity is invalid');
  }

  assertRecord(value.artifact, 'knowledge-public-v1 lock artifact');
  assertExactKeys(value.artifact, ['name', 'sha256'], 'knowledge-public-v1 lock artifact');
  if (
    value.artifact.name !== 'knowledge-public-v1.json' ||
    typeof value.artifact.sha256 !== 'string' ||
    !SHA256_RE.test(value.artifact.sha256)
  ) {
    throw new Error('knowledge-public-v1 lock artifact is invalid');
  }

  assertRecord(value.manifest, 'knowledge-public-v1 lock manifest');
  assertExactKeys(value.manifest, ['name', 'sha256'], 'knowledge-public-v1 lock manifest');
  if (
    value.manifest.name !== 'knowledge-public-v1.manifest.json' ||
    typeof value.manifest.sha256 !== 'string' ||
    !SHA256_RE.test(value.manifest.sha256)
  ) {
    throw new Error('knowledge-public-v1 lock manifest is invalid');
  }

  return value as KnowledgePublicV1Lock;
}

export function verifyKnowledgePublicV1Artifact(
  lock: KnowledgePublicV1Lock,
  raw: string,
): KnowledgePublicV1 {
  const actualDigest = digest(raw);
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
  return projection;
}

export function verifyKnowledgePublicV1Manifest(lock: KnowledgePublicV1Lock, raw: string): void {
  const actualDigest = digest(raw);
  if (actualDigest !== lock.manifest.sha256) {
    throw new Error(
      `knowledge-public-v1 manifest digest mismatch: expected ${lock.manifest.sha256}, got ${actualDigest}`,
    );
  }

  const value: unknown = JSON.parse(raw);
  assertRecord(value, 'knowledge-public-v1 producer manifest');
  assertRecord(value.metadata, 'knowledge-public-v1 producer manifest metadata');
  assertRecord(value.spec, 'knowledge-public-v1 producer manifest spec');
  assertRecord(value.spec.source, 'knowledge-public-v1 producer manifest source');
  assertRecord(value.spec.artifact, 'knowledge-public-v1 producer manifest artifact');

  if (
    value.apiVersion !== 'pds/v1alpha1' ||
    value.kind !== 'DataProductManifest' ||
    value.metadata.id !== 'knowledge-public-v1' ||
    value.spec.source.repository !== 'https://github.com/BakerSean168/thought-forest.git' ||
    value.spec.source.revision !== lock.sourceRevision ||
    value.spec.artifact.path !== 'generated/knowledge-public-v1.json' ||
    value.spec.artifact.mediaType !== 'application/vnd.pds.knowledge-public-v1+json' ||
    value.spec.artifact.generated !== true ||
    value.spec.artifact.editable !== false
  ) {
    throw new Error('knowledge-public-v1 producer manifest contract mismatch');
  }
}
