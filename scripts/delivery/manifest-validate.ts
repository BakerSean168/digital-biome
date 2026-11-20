import {
  assertExactKeys,
  assertRecord,
  parsePublicDataProductLock,
} from '../data-products/lock-v1';
import { publicDataProducts } from '../data-products/registry';
import {
  DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT,
  parseDigitalBiomePrivateInfrastructureLock,
} from '../data-products/private-infrastructure-lock';
import {
  CANDIDATE_SCHEMA,
  RELEASE_SCHEMA,
  SEMVER_RE,
  SHA256_RE,
  SHA_RE,
  identityDigest,
  type JsonRecord,
} from './manifest-schema';

// Pure validators: no filesystem or process access. Error strings are part of the
// workflow contract (they surface in CI logs).

function validateArtifact(artifact: unknown): string[] {
  const errors: string[] = [];
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return ['artifact must be an object'];
  }
  const typed = artifact as JsonRecord;
  try {
    assertExactKeys(typed, ['file', 'sha256', 'bytes'], 'artifact');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unexpected artifact fields');
  }
  if (typed.file !== 'digital-biome-pages.tar.gz') {
    errors.push('artifact.file must be digital-biome-pages.tar.gz');
  }
  if (!SHA256_RE.test(String(typed.sha256 ?? ''))) {
    errors.push('artifact.sha256 must be sha256:<64 hex>');
  }
  if (!Number.isInteger(typed.bytes) || Number(typed.bytes) <= 0) {
    errors.push('artifact.bytes must be a positive integer');
  }
  return errors;
}

function validateDigest(value: JsonRecord, label: string): string[] {
  if (!SHA256_RE.test(String(value.digest ?? ''))) {
    return [`${label} digest must be sha256:<64 hex>`];
  }
  const expected = identityDigest(value);
  return value.digest === expected ? [] : [`${label} digest mismatch: expected ${expected}`];
}

/** Parse exactly two public products and one protected binding. */
export function parseInputs(value: JsonRecord) {
  assertRecord(value.dataProducts, 'dataProducts');
  assertExactKeys(
    value.dataProducts,
    publicDataProducts.map((product) => product.product),
    'dataProducts',
  );
  const inputs = value.dataProducts;
  const dataProducts = Object.fromEntries(
    publicDataProducts.map((definition) => {
      const lock = parsePublicDataProductLock(inputs[definition.product]);
      if (lock.product !== definition.product)
        throw new Error('dataProducts key/identity mismatch');
      return [definition.product, lock];
    }),
  );
  assertRecord(value.privateBindings, 'privateBindings');
  assertExactKeys(
    value.privateBindings,
    [DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT],
    'privateBindings',
  );
  const binding = parseDigitalBiomePrivateInfrastructureLock(
    JSON.stringify(value.privateBindings[DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT]),
  );
  return {
    dataProducts,
    privateBindings: { [DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT]: binding },
  };
}

function validateInputs(value: JsonRecord): string[] {
  try {
    parseInputs(value);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : 'Invalid v6 inputs'];
  }
}

function validateManifestKeys(value: JsonRecord, kind: 'candidate' | 'release'): string[] {
  const fields =
    kind === 'candidate'
      ? [
          'schema',
          'gitSha',
          'ciRunId',
          'dataProducts',
          'privateBindings',
          'artifact',
          'generatedAt',
          'digest',
        ]
      : [
          'schema',
          'version',
          'tag',
          'gitSha',
          'ciRunId',
          'candidateRunId',
          'candidateManifestDigest',
          'dataProducts',
          'privateBindings',
          'artifact',
          'generatedAt',
          'digest',
        ];
  try {
    assertExactKeys(value, fields, kind);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : 'Unexpected manifest keys'];
  }
}

export function validateCandidate(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['candidate must be an object'];
  }
  const candidate = value as JsonRecord;
  const errors = validateManifestKeys(candidate, 'candidate');
  if (candidate.schema !== CANDIDATE_SCHEMA) errors.push(`schema must be ${CANDIDATE_SCHEMA}`);
  if (!SHA_RE.test(String(candidate.gitSha ?? ''))) errors.push('gitSha must be a full Git SHA');
  if (!/^\d+$/.test(String(candidate.ciRunId ?? ''))) errors.push('ciRunId must be numeric');
  errors.push(...validateInputs(candidate));
  errors.push(...validateArtifact(candidate.artifact));
  errors.push(...validateDigest(candidate, 'candidate'));
  return errors;
}

export function validateReleaseManifest(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['release must be an object'];
  }
  const release = value as JsonRecord;
  const errors = validateManifestKeys(release, 'release');
  if (release.schema !== RELEASE_SCHEMA) errors.push(`schema must be ${RELEASE_SCHEMA}`);
  if (!SEMVER_RE.test(String(release.version ?? '')))
    errors.push('version must be semantic version');
  if (release.tag !== `v${release.version}`) errors.push('tag must equal v<version>');
  if (!SHA_RE.test(String(release.gitSha ?? ''))) errors.push('gitSha must be a full Git SHA');
  if (!/^\d+$/.test(String(release.ciRunId ?? ''))) errors.push('ciRunId must be numeric');
  if (!/^\d+$/.test(String(release.candidateRunId ?? '')))
    errors.push('candidateRunId must be numeric');
  if (!SHA256_RE.test(String(release.candidateManifestDigest ?? ''))) {
    errors.push('candidateManifestDigest must be sha256:<64 hex>');
  }
  errors.push(...validateInputs(release));
  errors.push(...validateArtifact(release.artifact));
  errors.push(...validateDigest(release, 'release'));
  return errors;
}
