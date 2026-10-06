import { getPublicDataProduct, type PublicDataProduct } from './registry';
import { canonicalJson } from './semantic-digest';

export interface PublicDataProductLock {
  protocolVersion: 1;
  product: PublicDataProduct;
  producerRepository: string;
  sourceRevision: string;
  releaseTag: string;
  artifact: { name: string; sha256: string };
  manifest: { name: string; sha256: string };
  semanticSha256: string;
  consumerMetadata?: Record<string, unknown>;
}

export function assertRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error(`${label} must be a JSON object`);
  }
}

export function assertExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  label: string,
  optional: readonly string[] = [],
): void {
  if (
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))
  ) {
    throw new Error(`${label} fields mismatch`);
  }
}

function digest(value: unknown): string {
  if (typeof value !== 'string' || value.length !== 71 || !/^sha256:[0-9a-f]{64}$/.test(value)) {
    throw new Error('Invalid lowercase sha256 digest');
  }
  return value;
}

function asset(value: unknown, name: string): { name: string; sha256: string } {
  assertRecord(value, 'asset');
  assertExactKeys(value, ['name', 'sha256'], 'asset');
  if (value.name !== name) throw new Error('Asset name mismatch');
  return { name, sha256: digest(value.sha256) };
}

/** Accept decoded JSON, not a trusted TypeScript cast. Never reads or writes files. */
export function parsePublicDataProductLock(value: unknown): PublicDataProductLock {
  assertRecord(value, 'public lock');
  assertExactKeys(
    value,
    [
      'protocolVersion',
      'product',
      'producerRepository',
      'sourceRevision',
      'releaseTag',
      'artifact',
      'manifest',
      'semanticSha256',
    ],
    'public lock',
    ['consumerMetadata'],
  );
  const definition = getPublicDataProduct(value.product, value.producerRepository);
  if (
    value.protocolVersion !== 1 ||
    typeof value.sourceRevision !== 'string' ||
    value.sourceRevision.length !== 40 ||
    !/^[0-9a-f]{40}$/.test(value.sourceRevision) ||
    value.releaseTag !== `${definition.product}-${value.sourceRevision}`
  ) {
    throw new Error('Public lock protocol/tag/source identity is invalid');
  }
  if (Object.hasOwn(value, 'consumerMetadata'))
    assertRecord(value.consumerMetadata, 'consumerMetadata');
  return {
    protocolVersion: 1,
    product: definition.product,
    producerRepository: definition.producerRepository,
    sourceRevision: value.sourceRevision,
    releaseTag: value.releaseTag,
    artifact: asset(value.artifact, definition.artifactName),
    manifest: asset(value.manifest, definition.manifestName),
    semanticSha256: digest(value.semanticSha256),
    ...(Object.hasOwn(value, 'consumerMetadata')
      ? { consumerMetadata: value.consumerMetadata as Record<string, unknown> }
      : {}),
  };
}

/** Notification adapter: same validation as the lock, with no metadata escape hatch. */
export function parseDataProductPublished(value: unknown): PublicDataProductLock {
  assertRecord(value, 'publication event');
  assertExactKeys(
    value,
    [
      'protocol_version',
      'product',
      'producer_repository',
      'source_revision',
      'release_tag',
      'artifact',
      'manifest',
      'semantic_sha256',
    ],
    'publication event',
  );
  return parsePublicDataProductLock({
    protocolVersion: value.protocol_version,
    product: value.product,
    producerRepository: value.producer_repository,
    sourceRevision: value.source_revision,
    releaseTag: value.release_tag,
    artifact: value.artifact,
    manifest: value.manifest,
    semanticSha256: value.semantic_sha256,
  });
}

/** Stable producer identity only; consumer annotations can never affect PR comparison. */
export function canonicalLockIdentity(value: unknown): string {
  const { consumerMetadata: _metadata, ...identity } = parsePublicDataProductLock(value);
  return canonicalJson(identity);
}
