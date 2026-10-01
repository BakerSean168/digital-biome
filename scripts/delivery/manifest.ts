#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANDIDATE_SCHEMA = 'digital-biome.candidate/v1';
export const RELEASE_SCHEMA = 'digital-biome.release/v1';

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

export function createCandidate(inputValue: unknown, generatedAt = new Date().toISOString()) {
  const input = asObject(inputValue, 'candidate input');
  const artifact = asObject(input.artifact, 'candidate artifact');
  const candidate: JsonRecord = {
    schema: CANDIDATE_SCHEMA,
    gitSha: input.gitSha,
    ciRunId: String(input.ciRunId ?? ''),
    vaultSha: input.vaultSha,
    assetIndexSha256: input.assetIndexSha256,
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

export function validateCandidate(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['candidate must be an object'];
  }
  const candidate = value as JsonRecord;
  const errors: string[] = [];
  if (candidate.schema !== CANDIDATE_SCHEMA) errors.push(`schema must be ${CANDIDATE_SCHEMA}`);
  if (!SHA_RE.test(String(candidate.gitSha ?? ''))) errors.push('gitSha must be a full Git SHA');
  if (!/^\d+$/.test(String(candidate.ciRunId ?? ''))) errors.push('ciRunId must be numeric');
  if (!SHA_RE.test(String(candidate.vaultSha ?? '')))
    errors.push('vaultSha must be a full Git SHA');
  if (!SHA256_RE.test(String(candidate.assetIndexSha256 ?? ''))) {
    errors.push('assetIndexSha256 must be sha256:<64 hex>');
  }
  errors.push(...validateArtifact(candidate.artifact));
  if (!SHA256_RE.test(String(candidate.digest ?? ''))) {
    errors.push('digest must be sha256:<64 hex>');
  } else {
    const expected = identityDigest(candidate);
    if (candidate.digest !== expected)
      errors.push(`candidate digest mismatch: expected ${expected}`);
  }
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
  const release: JsonRecord = {
    schema: RELEASE_SCHEMA,
    version,
    tag,
    gitSha: candidate.gitSha,
    ciRunId: candidate.ciRunId,
    candidateRunId,
    candidateManifestDigest: candidate.digest,
    vaultSha: candidate.vaultSha,
    assetIndexSha256: candidate.assetIndexSha256,
    artifact: candidate.artifact,
    generatedAt,
  };
  release.digest = identityDigest(release);
  return release;
}

export function validateReleaseManifest(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['release must be an object'];
  }
  const release = value as JsonRecord;
  const errors: string[] = [];
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
  if (!SHA_RE.test(String(release.vaultSha ?? ''))) errors.push('vaultSha must be a full Git SHA');
  if (!SHA256_RE.test(String(release.assetIndexSha256 ?? ''))) {
    errors.push('assetIndexSha256 must be sha256:<64 hex>');
  }
  errors.push(...validateArtifact(release.artifact));
  if (!SHA256_RE.test(String(release.digest ?? ''))) {
    errors.push('digest must be sha256:<64 hex>');
  } else {
    const expected = identityDigest(release);
    if (release.digest !== expected) errors.push(`release digest mismatch: expected ${expected}`);
  }
  return errors;
}

export function releaseProvenanceMessage(value: unknown): string {
  const errors = validateReleaseManifest(value);
  if (errors.length) throw new Error(`invalid release: ${errors.join('; ')}`);

  const release = value as JsonRecord;
  const artifact = release.artifact as JsonRecord;
  return [
    'digital-biome.release/v1',
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
    const errors =
      value.schema === CANDIDATE_SCHEMA ? validateCandidate(value) : validateReleaseManifest(value);
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
