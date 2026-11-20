import {
  CANDIDATE_SCHEMA,
  RELEASE_SCHEMA,
  SEMVER_RE,
  identityDigest,
  type JsonRecord,
} from './manifest-schema';
import { parseInputs, validateCandidate, validateReleaseManifest } from './manifest-validate';
import { assertExactKeys } from '../data-products/lock-v1';

// Exact current-schema manifest construction. Older artifact bytes remain immutable.

function asObject(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

export function createCandidate(inputValue: unknown, generatedAt = new Date().toISOString()) {
  const input = asObject(inputValue, 'candidate input');
  assertExactKeys(
    input,
    ['gitSha', 'ciRunId', 'dataProducts', 'privateBindings', 'artifact'],
    'candidate input',
  );
  const artifact = asObject(input.artifact, 'candidate artifact');
  assertExactKeys(artifact, ['file', 'sha256', 'bytes'], 'candidate artifact');
  const candidate: JsonRecord = {
    schema: CANDIDATE_SCHEMA,
    gitSha: input.gitSha,
    ciRunId: String(input.ciRunId ?? ''),
    ...parseInputs(input),
    artifact: { file: artifact.file, sha256: artifact.sha256, bytes: Number(artifact.bytes) },
    generatedAt,
  };
  candidate.digest = identityDigest(candidate);
  const errors = validateCandidate(candidate);
  if (errors.length) throw new Error(errors.join('; '));
  return candidate;
}

export function createReleaseManifest(
  candidateValue: unknown,
  version: string,
  tag: string,
  candidateRunId: string,
  generatedAt = new Date().toISOString(),
) {
  const candidateErrors = validateCandidate(candidateValue);
  if (candidateErrors.length) throw new Error(`invalid candidate: ${candidateErrors.join('; ')}`);
  if (!SEMVER_RE.test(version)) throw new Error('version must be semantic version');
  if (tag !== `v${version}`) throw new Error('tag must equal v<version>');
  if (!/^\d+$/.test(candidateRunId)) throw new Error('candidate run ID must be numeric');

  const candidate = candidateValue as JsonRecord;
  const release: JsonRecord = {
    schema: RELEASE_SCHEMA,
    version,
    tag,
    gitSha: candidate.gitSha,
    ciRunId: candidate.ciRunId,
    candidateRunId,
    candidateManifestDigest: candidate.digest,
    dataProducts: candidate.dataProducts,
    privateBindings: candidate.privateBindings,
    artifact: candidate.artifact,
    generatedAt,
  };
  release.digest = identityDigest(release);
  return release;
}

export function releaseProvenanceMessage(value: unknown): string {
  const errors = validateReleaseManifest(value);
  if (errors.length) throw new Error(`invalid release: ${errors.join('; ')}`);

  const release = value as JsonRecord;
  const artifact = release.artifact as JsonRecord;
  return [
    String(release.schema),
    `release-manifest-digest: ${String(release.digest)}`,
    `artifact-sha256: ${String(artifact.sha256)}`,
    `candidate-manifest-digest: ${String(release.candidateManifestDigest)}`,
  ].join('\n');
}
