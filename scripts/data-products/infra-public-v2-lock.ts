import crypto from 'node:crypto';
import {
  parseInfraPublicV2,
  type InfraPublicV2,
} from '../../src/domain/infrastructure/infra-public-v2';

export const INFRA_PUBLIC_V2_PRODUCER = 'BakerSean168/personal-infrastructure';

export type InfraPublicV2Lock = {
  schemaVersion: 1;
  product: 'infra-public-v2';
  producerRepository: typeof INFRA_PUBLIC_V2_PRODUCER;
  sourceRevision: string;
  releaseTag: string;
  artifact: {
    name: 'infra-public-v2.json';
    sha256: string;
  };
  manifest: {
    name: 'infra-public-v2.manifest.json';
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

export function parseInfraPublicV2Lock(raw: string): InfraPublicV2Lock {
  const value: unknown = JSON.parse(raw);
  assertRecord(value, 'infra-public-v2 lock');
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
    'infra-public-v2 lock',
  );

  if (
    value.schemaVersion !== 1 ||
    value.product !== 'infra-public-v2' ||
    value.producerRepository !== INFRA_PUBLIC_V2_PRODUCER ||
    typeof value.sourceRevision !== 'string' ||
    !SHA_RE.test(value.sourceRevision) ||
    value.releaseTag !== `infra-public-v2-${value.sourceRevision}`
  ) {
    throw new Error('infra-public-v2 lock identity is invalid');
  }

  assertRecord(value.artifact, 'infra-public-v2 lock artifact');
  assertExactKeys(value.artifact, ['name', 'sha256'], 'infra-public-v2 lock artifact');
  if (
    value.artifact.name !== 'infra-public-v2.json' ||
    typeof value.artifact.sha256 !== 'string' ||
    !SHA256_RE.test(value.artifact.sha256)
  ) {
    throw new Error('infra-public-v2 lock artifact is invalid');
  }

  assertRecord(value.manifest, 'infra-public-v2 lock manifest');
  assertExactKeys(value.manifest, ['name', 'sha256'], 'infra-public-v2 lock manifest');
  if (
    value.manifest.name !== 'infra-public-v2.manifest.json' ||
    typeof value.manifest.sha256 !== 'string' ||
    !SHA256_RE.test(value.manifest.sha256)
  ) {
    throw new Error('infra-public-v2 lock manifest is invalid');
  }

  return value as InfraPublicV2Lock;
}

export function verifyInfraPublicV2Artifact(lock: InfraPublicV2Lock, raw: string): InfraPublicV2 {
  const actualDigest = digest(raw);
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
  return projection;
}

export function verifyInfraPublicV2Manifest(lock: InfraPublicV2Lock, raw: string): void {
  const actualDigest = digest(raw);
  if (actualDigest !== lock.manifest.sha256) {
    throw new Error(
      `infra-public-v2 manifest digest mismatch: expected ${lock.manifest.sha256}, got ${actualDigest}`,
    );
  }

  const value: unknown = JSON.parse(raw);
  assertRecord(value, 'infra-public-v2 producer manifest');
  assertRecord(value.metadata, 'infra-public-v2 producer manifest metadata');
  assertRecord(value.spec, 'infra-public-v2 producer manifest spec');
  assertRecord(value.spec.producer, 'infra-public-v2 producer manifest producer');
  assertRecord(value.spec.contract, 'infra-public-v2 producer manifest contract');
  assertRecord(value.spec.source, 'infra-public-v2 producer manifest source');
  assertRecord(value.spec.artifact, 'infra-public-v2 producer manifest artifact');

  if (
    value.apiVersion !== 'pds/v1alpha1' ||
    value.kind !== 'DataProductManifest' ||
    value.metadata.id !== 'infra-public-v2' ||
    value.spec.producer.ref !== 'pds://system/component/personal-infrastructure' ||
    value.spec.contract.name !== 'infra-public' ||
    value.spec.contract.version !== 'v2' ||
    value.spec.source.repository !==
      'https://github.com/BakerSean168/personal-infrastructure.git' ||
    value.spec.source.revision !== lock.sourceRevision ||
    value.spec.artifact.path !== 'generated/infra-public-v2.json' ||
    value.spec.artifact.mediaType !== 'application/vnd.pds.infra-public-v2+json' ||
    value.spec.artifact.generated !== true ||
    value.spec.artifact.editable !== false
  ) {
    throw new Error('infra-public-v2 producer manifest contract mismatch');
  }
}
