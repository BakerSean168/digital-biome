import { createHash } from 'node:crypto';

// Immutable delivery manifest schema identities. v5 is written today; v3/v4 stay
// accepted so previously published Releases remain deployable for rollback.
export const CANDIDATE_SCHEMA = 'digital-biome.candidate/v5';
export const V4_CANDIDATE_SCHEMA = 'digital-biome.candidate/v4';
export const RELEASE_SCHEMA = 'digital-biome.release/v5';
export const V4_RELEASE_SCHEMA = 'digital-biome.release/v4';
export const PREVIOUS_CANDIDATE_SCHEMA = 'digital-biome.candidate/v3';
export const PREVIOUS_RELEASE_SCHEMA = 'digital-biome.release/v3';

export const KNOWLEDGE_PRODUCER_REPOSITORY = 'BakerSean168/thought-forest';
export const INFRASTRUCTURE_PRODUCER_REPOSITORY = 'BakerSean168/personal-infrastructure';
export const PRIVATE_INFRASTRUCTURE_CONTRACT_PATH =
  'bindings/digital-biome/private-infrastructure-v1.json';
export const SHA_RE = /^[0-9a-f]{40}$/i;
export const SHA256_RE = /^sha256:[0-9a-f]{64}$/i;
export const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export type JsonRecord = Record<string, unknown>;

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

/** Digest over every field except `digest` and the non-identity `generatedAt`. */
export function identityDigest(manifest: JsonRecord): string {
  const { digest: _digest, generatedAt: _generatedAt, ...identity } = manifest;
  return sha256Json(identity);
}
