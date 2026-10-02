#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANDIDATE_SCHEMA = 'digital-biome.candidate/v4';
export const RELEASE_SCHEMA = 'digital-biome.release/v4';
export const PREVIOUS_CANDIDATE_SCHEMA = 'digital-biome.candidate/v3';
export const PREVIOUS_RELEASE_SCHEMA = 'digital-biome.release/v3';
export const V2_CANDIDATE_SCHEMA = 'digital-biome.candidate/v2';
export const V2_RELEASE_SCHEMA = 'digital-biome.release/v2';
export const LEGACY_CANDIDATE_SCHEMA = 'digital-biome.candidate/v1';
export const LEGACY_RELEASE_SCHEMA = 'digital-biome.release/v1';

const KNOWLEDGE_PRODUCER_REPOSITORY = 'BakerSean168/thought-forest';
const INFRASTRUCTURE_PRODUCER_REPOSITORY = 'BakerSean168/personal-infrastructure';
const PRIVATE_INFRASTRUCTURE_CONTRACT_PATH =
  'bindings/digital-biome/private-infrastructure-v1.json';
const SHA_RE = /^[0-9a-f]{40}$/i;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/i;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
type JsonRecord = Record<string, unknown>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function sha256Json(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')}`;
}

function identityDigest(manifest: JsonRecord): string {
  const { digest: _digest, generatedAt: _generatedAt, ...identity } = manifest;
  return sha256Json(identity);
}

function asObject(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function validateArtifact(artifact: unknown): string[] {
  const errors: string[] = [];
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return ['artifact must be an object'];
  }
  const typed = artifact as JsonRecord;
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

function validateKnowledgeIdentity(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['knowledge must be an object'];
  }
  const knowledge = value as JsonRecord;
  if (knowledge.producerRepository !== KNOWLEDGE_PRODUCER_REPOSITORY) {
    errors.push(`knowledge.producerRepository must be ${KNOWLEDGE_PRODUCER_REPOSITORY}`);
  }
  const sourceRevision = String(knowledge.sourceRevision ?? '');
  if (!SHA_RE.test(sourceRevision)) errors.push('knowledge.sourceRevision must be a full Git SHA');
  if (knowledge.releaseTag !== `knowledge-public-v1-${sourceRevision}`) {
    errors.push('knowledge.releaseTag must equal knowledge-public-v1-<sourceRevision>');
  }
  if (!SHA256_RE.test(String(knowledge.artifactSha256 ?? ''))) {
    errors.push('knowledge.artifactSha256 must be sha256:<64 hex>');
  }
  if (!SHA256_RE.test(String(knowledge.manifestSha256 ?? ''))) {
    errors.push('knowledge.manifestSha256 must be sha256:<64 hex>');
  }
  return errors;
}

function validatePublicInfrastructureIdentity(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['publicInfrastructure must be an object'];
  }
  const identity = value as JsonRecord;
  if (identity.producerRepository !== INFRASTRUCTURE_PRODUCER_REPOSITORY) {
    errors.push(
      `publicInfrastructure.producerRepository must be ${INFRASTRUCTURE_PRODUCER_REPOSITORY}`,
    );
  }
  const sourceRevision = String(identity.sourceRevision ?? '');
  if (!SHA_RE.test(sourceRevision)) {
    errors.push('publicInfrastructure.sourceRevision must be a full Git SHA');
  }
  if (identity.releaseTag !== `infra-public-v2-${sourceRevision}`) {
    errors.push('publicInfrastructure.releaseTag must equal infra-public-v2-<sourceRevision>');
  }
  if (!SHA256_RE.test(String(identity.artifactSha256 ?? ''))) {
    errors.push('publicInfrastructure.artifactSha256 must be sha256:<64 hex>');
  }
  if (!SHA256_RE.test(String(identity.manifestSha256 ?? ''))) {
    errors.push('publicInfrastructure.manifestSha256 must be sha256:<64 hex>');
  }
  return errors;
}

function validatePrivateInfrastructureIdentity(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['privateInfrastructure must be an object'];
  }
  const identity = value as JsonRecord;
  if (identity.producerRepository !== INFRASTRUCTURE_PRODUCER_REPOSITORY) {
    errors.push(
      `privateInfrastructure.producerRepository must be ${INFRASTRUCTURE_PRODUCER_REPOSITORY}`,
    );
  }
  if (!SHA_RE.test(String(identity.sourceRevision ?? ''))) {
    errors.push('privateInfrastructure.sourceRevision must be a full Git SHA');
  }
  if (identity.contractPath !== PRIVATE_INFRASTRUCTURE_CONTRACT_PATH) {
    errors.push(
      `privateInfrastructure.contractPath must be ${PRIVATE_INFRASTRUCTURE_CONTRACT_PATH}`,
    );
  }
  if (!SHA256_RE.test(String(identity.sha256 ?? ''))) {
    errors.push('privateInfrastructure.sha256 must be sha256:<64 hex>');
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

export function createCandidate(inputValue: unknown, generatedAt = new Date().toISOString()) {
  const input = asObject(inputValue, 'candidate input');
  const artifact = asObject(input.artifact, 'candidate artifact');
  const knowledge = asObject(input.knowledge, 'candidate knowledge');
  const publicInfrastructure = asObject(
    input.publicInfrastructure,
    'candidate public infrastructure',
  );
  const privateInfrastructure = asObject(
    input.privateInfrastructure,
    'candidate private infrastructure',
  );

  const candidate: JsonRecord = {
    schema: CANDIDATE_SCHEMA,
    gitSha: input.gitSha,
    ciRunId: String(input.ciRunId ?? ''),
    knowledge: {
      producerRepository: knowledge.producerRepository,
      sourceRevision: knowledge.sourceRevision,
      releaseTag: knowledge.releaseTag,
      artifactSha256: knowledge.artifactSha256,
      manifestSha256: knowledge.manifestSha256,
    },
    publicInfrastructure: {
      producerRepository: publicInfrastructure.producerRepository,
      sourceRevision: publicInfrastructure.sourceRevision,
      releaseTag: publicInfrastructure.releaseTag,
      artifactSha256: publicInfrastructure.artifactSha256,
      manifestSha256: publicInfrastructure.manifestSha256,
    },
    privateInfrastructure: {
      producerRepository: privateInfrastructure.producerRepository,
      sourceRevision: privateInfrastructure.sourceRevision,
      contractPath: privateInfrastructure.contractPath,
      sha256: privateInfrastructure.sha256,
    },
    artifact: {
      file: artifact.file,
      sha256: artifact.sha256,
      bytes: Number(artifact.bytes),
    },
    generatedAt,
  };
  candidate.digest = identityDigest(candidate);
  return candidate;
}

function validateLegacyCandidate(candidate: JsonRecord): string[] {
  const errors: string[] = [];
  if (!SHA_RE.test(String(candidate.gitSha ?? ''))) errors.push('gitSha must be a full Git SHA');
  if (!/^\d+$/.test(String(candidate.ciRunId ?? ''))) errors.push('ciRunId must be numeric');
  if (!SHA_RE.test(String(candidate.vaultSha ?? '')))
    errors.push('vaultSha must be a full Git SHA');
  if (!SHA256_RE.test(String(candidate.assetIndexSha256 ?? ''))) {
    errors.push('assetIndexSha256 must be sha256:<64 hex>');
  }
  errors.push(...validateArtifact(candidate.artifact));
  errors.push(...validateDigest(candidate, 'candidate'));
  return errors;
}

function validateV2Candidate(candidate: JsonRecord): string[] {
  const errors: string[] = [];
  if (!SHA_RE.test(String(candidate.gitSha ?? ''))) errors.push('gitSha must be a full Git SHA');
  if (!/^\d+$/.test(String(candidate.ciRunId ?? ''))) errors.push('ciRunId must be numeric');
  errors.push(...validateKnowledgeIdentity(candidate.knowledge));
  errors.push(...validateArtifact(candidate.artifact));
  errors.push(...validateDigest(candidate, 'candidate'));
  return errors;
}

function validateV3Candidate(candidate: JsonRecord): string[] {
  const errors = validateV2Candidate(candidate);
  errors.push(...validatePrivateInfrastructureIdentity(candidate.privateInfrastructure));
  return errors;
}

export function validateCandidate(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['candidate must be an object'];
  }
  const candidate = value as JsonRecord;
  if (candidate.schema === LEGACY_CANDIDATE_SCHEMA) return validateLegacyCandidate(candidate);
  if (candidate.schema === V2_CANDIDATE_SCHEMA) return validateV2Candidate(candidate);
  if (candidate.schema === PREVIOUS_CANDIDATE_SCHEMA) return validateV3Candidate(candidate);

  const errors: string[] = [];
  if (candidate.schema !== CANDIDATE_SCHEMA) errors.push(`schema must be ${CANDIDATE_SCHEMA}`);
  if (!SHA_RE.test(String(candidate.gitSha ?? ''))) errors.push('gitSha must be a full Git SHA');
  if (!/^\d+$/.test(String(candidate.ciRunId ?? ''))) errors.push('ciRunId must be numeric');
  errors.push(...validateKnowledgeIdentity(candidate.knowledge));
  errors.push(...validatePublicInfrastructureIdentity(candidate.publicInfrastructure));
  errors.push(...validatePrivateInfrastructureIdentity(candidate.privateInfrastructure));
  errors.push(...validateArtifact(candidate.artifact));
  errors.push(...validateDigest(candidate, 'candidate'));
  return errors;
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
  const schema = candidate.schema;
  const releaseSchema =
    schema === LEGACY_CANDIDATE_SCHEMA
      ? LEGACY_RELEASE_SCHEMA
      : schema === V2_CANDIDATE_SCHEMA
        ? V2_RELEASE_SCHEMA
        : schema === PREVIOUS_CANDIDATE_SCHEMA
          ? PREVIOUS_RELEASE_SCHEMA
          : RELEASE_SCHEMA;

  const release: JsonRecord = {
    schema: releaseSchema,
    version,
    tag,
    gitSha: candidate.gitSha,
    ciRunId: candidate.ciRunId,
    candidateRunId,
    candidateManifestDigest: candidate.digest,
    ...(schema === LEGACY_CANDIDATE_SCHEMA
      ? { vaultSha: candidate.vaultSha, assetIndexSha256: candidate.assetIndexSha256 }
      : schema === V2_CANDIDATE_SCHEMA
        ? { knowledge: candidate.knowledge }
        : schema === PREVIOUS_CANDIDATE_SCHEMA
          ? {
              knowledge: candidate.knowledge,
              privateInfrastructure: candidate.privateInfrastructure,
            }
          : {
              knowledge: candidate.knowledge,
              publicInfrastructure: candidate.publicInfrastructure,
              privateInfrastructure: candidate.privateInfrastructure,
            }),
    artifact: candidate.artifact,
    generatedAt,
  };
  release.digest = identityDigest(release);
  return release;
}

function validateReleaseBase(release: JsonRecord): string[] {
  const errors: string[] = [];
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
  return errors;
}

function validateLegacyRelease(release: JsonRecord): string[] {
  const errors = validateReleaseBase(release);
  if (!SHA_RE.test(String(release.vaultSha ?? ''))) errors.push('vaultSha must be a full Git SHA');
  if (!SHA256_RE.test(String(release.assetIndexSha256 ?? ''))) {
    errors.push('assetIndexSha256 must be sha256:<64 hex>');
  }
  errors.push(...validateArtifact(release.artifact));
  errors.push(...validateDigest(release, 'release'));
  return errors;
}

function validateV2Release(release: JsonRecord): string[] {
  const errors = validateReleaseBase(release);
  errors.push(...validateKnowledgeIdentity(release.knowledge));
  errors.push(...validateArtifact(release.artifact));
  errors.push(...validateDigest(release, 'release'));
  return errors;
}

function validateV3Release(release: JsonRecord): string[] {
  const errors = validateV2Release(release);
  errors.push(...validatePrivateInfrastructureIdentity(release.privateInfrastructure));
  return errors;
}

export function validateReleaseManifest(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['release must be an object'];
  }
  const release = value as JsonRecord;
  if (release.schema === LEGACY_RELEASE_SCHEMA) return validateLegacyRelease(release);
  if (release.schema === V2_RELEASE_SCHEMA) return validateV2Release(release);
  if (release.schema === PREVIOUS_RELEASE_SCHEMA) return validateV3Release(release);

  const errors = validateReleaseBase(release);
  if (release.schema !== RELEASE_SCHEMA) errors.push(`schema must be ${RELEASE_SCHEMA}`);
  errors.push(...validateKnowledgeIdentity(release.knowledge));
  errors.push(...validatePublicInfrastructureIdentity(release.publicInfrastructure));
  errors.push(...validatePrivateInfrastructureIdentity(release.privateInfrastructure));
  errors.push(...validateArtifact(release.artifact));
  errors.push(...validateDigest(release, 'release'));
  return errors;
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

function parseFlags(tokens: string[]) {
  const flags: Record<string, string> = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${token}`);
    flags[token.slice(2)] = value;
    index += 1;
  }
  return flags;
}

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

function writeJson(file: string, value: unknown) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  if (command === 'candidate') {
    if (!flags.input || !flags.output) throw new Error('candidate requires --input and --output');
    const candidate = createCandidate(readJson(flags.input));
    const errors = validateCandidate(candidate);
    if (errors.length) throw new Error(errors.join('; '));
    writeJson(flags.output, candidate);
    console.log(`CANDIDATE_MANIFEST=PASS digest=${candidate.digest}`);
    return;
  }

  if (command === 'release') {
    for (const key of ['candidate', 'version', 'tag', 'candidate-run-id', 'output']) {
      if (!flags[key]) throw new Error(`release requires --${key}`);
    }
    const release = createReleaseManifest(
      readJson(flags.candidate),
      flags.version,
      flags.tag,
      flags['candidate-run-id'],
    );
    const errors = validateReleaseManifest(release);
    if (errors.length) throw new Error(errors.join('; '));
    writeJson(flags.output, release);
    console.log(`RELEASE_MANIFEST=PASS digest=${release.digest}`);
    return;
  }

  if (command === 'validate') {
    if (!flags.file) throw new Error('validate requires --file');
    const value = readJson(flags.file) as JsonRecord;
    const errors = String(value.schema).startsWith('digital-biome.candidate/')
      ? validateCandidate(value)
      : validateReleaseManifest(value);
    if (errors.length) throw new Error(errors.join('; '));
    console.log(`DELIVERY_MANIFEST=PASS schema=${String(value.schema)}`);
    return;
  }

  if (command === 'provenance') {
    if (!flags.file) throw new Error('provenance requires --file');
    process.stdout.write(`${releaseProvenanceMessage(readJson(flags.file))}\n`);
    return;
  }

  throw new Error('usage: manifest.ts <candidate|release|validate|provenance> [flags]');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(
      `delivery manifest failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
