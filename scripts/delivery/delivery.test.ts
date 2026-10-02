import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  CANDIDATE_SCHEMA,
  LEGACY_CANDIDATE_SCHEMA,
  LEGACY_RELEASE_SCHEMA,
  RELEASE_SCHEMA,
  createCandidate,
  createReleaseManifest,
  releaseProvenanceMessage,
  validateCandidate,
  validateReleaseManifest,
} from './manifest.ts';
import { extractReleaseNotes, validateReleaseFiles } from './release-contract.ts';

const sha = 'a'.repeat(40);
const knowledgeSourceSha = 'b'.repeat(40);
const hash = `sha256:${'c'.repeat(64)}`;
const manifestHash = `sha256:${'d'.repeat(64)}`;

function knowledge() {
  return {
    producerRepository: 'BakerSean168/thought-forest',
    sourceRevision: knowledgeSourceSha,
    releaseTag: `knowledge-public-v1-${knowledgeSourceSha}`,
    artifactSha256: hash,
    manifestSha256: manifestHash,
  };
}

test('candidate and release preserve exact deployable and knowledge projection identities', () => {
  const candidate = createCandidate(
    {
      gitSha: sha,
      ciRunId: '12345',
      knowledge: knowledge(),
      artifact: {
        file: 'digital-biome-pages.tar.gz',
        sha256: hash,
        bytes: 123,
      },
    },
    '2026-10-01T00:00:00.000Z',
  );

  assert.equal(candidate.schema, CANDIDATE_SCHEMA);
  assert.deepEqual(validateCandidate(candidate), []);

  const release = createReleaseManifest(
    candidate,
    '0.6.0',
    'v0.6.0',
    '67890',
    '2026-10-01T01:00:00.000Z',
  );

  assert.equal(release.schema, RELEASE_SCHEMA);
  assert.deepEqual(validateReleaseManifest(release), []);
  assert.deepEqual(release.artifact, candidate.artifact);
  assert.deepEqual(release.knowledge, candidate.knowledge);
  assert.equal(release.gitSha, candidate.gitSha);
  assert.equal(
    releaseProvenanceMessage(release),
    [
      'digital-biome.release/v2',
      `release-manifest-digest: ${String(release.digest)}`,
      `artifact-sha256: ${hash}`,
      `candidate-manifest-digest: ${String(release.candidateManifestDigest)}`,
    ].join('\n'),
  );
});

test('candidate validation fails closed when artifact or knowledge identity changes', () => {
  const candidate = createCandidate({
    gitSha: sha,
    ciRunId: '12345',
    knowledge: knowledge(),
    artifact: {
      file: 'digital-biome-pages.tar.gz',
      sha256: hash,
      bytes: 123,
    },
  }) as Record<string, unknown>;

  candidate.artifact = {
    ...(candidate.artifact as Record<string, unknown>),
    sha256: `sha256:${'e'.repeat(64)}`,
  };
  assert.match(validateCandidate(candidate).join('; '), /candidate digest mismatch/);

  const changedKnowledgeCandidate = createCandidate({
    gitSha: sha,
    ciRunId: '12345',
    knowledge: knowledge(),
    artifact: {
      file: 'digital-biome-pages.tar.gz',
      sha256: hash,
      bytes: 123,
    },
  }) as Record<string, unknown>;
  changedKnowledgeCandidate.knowledge = {
    ...(changedKnowledgeCandidate.knowledge as Record<string, unknown>),
    sourceRevision: 'f'.repeat(40),
  };
  assert.match(
    validateCandidate(changedKnowledgeCandidate).join('; '),
    /releaseTag must equal|candidate digest mismatch/,
  );
});

test('legacy v1 delivery manifests remain valid for rollback deployment', () => {
  const legacyCandidate = {
    schema: LEGACY_CANDIDATE_SCHEMA,
    gitSha: sha,
    ciRunId: '12345',
    vaultSha: knowledgeSourceSha,
    assetIndexSha256: hash,
    artifact: {
      file: 'digital-biome-pages.tar.gz',
      sha256: hash,
      bytes: 123,
    },
    generatedAt: '2026-09-01T00:00:00.000Z',
  } as Record<string, unknown>;

  // Build a legacy manifest through the exported release factory after supplying a
  // legacy candidate digest generated with the same canonical digest algorithm.
  const digestless = { ...legacyCandidate };
  delete digestless.digest;
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, canonicalize(nested)]),
      );
    }
    return value;
  };
  const { generatedAt: _generatedAt, ...identity } = digestless;
  legacyCandidate.digest = `sha256:${createHash('sha256')
    .update(JSON.stringify(canonicalize(identity)))
    .digest('hex')}`;

  assert.deepEqual(validateCandidate(legacyCandidate), []);
  const legacyRelease = createReleaseManifest(
    legacyCandidate,
    '0.5.0',
    'v0.5.0',
    '67890',
    '2026-09-01T01:00:00.000Z',
  );
  assert.equal(legacyRelease.schema, LEGACY_RELEASE_SCHEMA);
  assert.deepEqual(validateReleaseManifest(legacyRelease), []);
});

test('release contract accepts only release-please-shaped commits', () => {
  const changelog = '# Changelog\n\n## [0.6.0] - 2026-10-01\n\n### Added\n\n- Delivery contract.\n';

  const accepted = validateReleaseFiles({
    packageVersion: '0.6.0',
    manifestVersion: '0.6.0',
    changelog,
    subjects: ['Merge pull request #100', 'chore(main): release 0.6.0'],
  });
  assert.deepEqual(accepted.errors, []);
  assert.equal(accepted.releaseShaped, true);

  const normal = validateReleaseFiles({
    packageVersion: '0.6.0',
    manifestVersion: '0.6.0',
    changelog,
    subjects: ['feat(nav): add shortcut'],
  });
  assert.deepEqual(normal.errors, []);
  assert.equal(normal.releaseShaped, false);
});

test('release notes stop at the next changelog section', () => {
  const changelog =
    '# Changelog\n\n## [0.6.0] - 2026-10-01\n\n### Added\n\n- A\n\n## [0.5.0] - 2026-09-11\n\n- B\n';

  assert.equal(
    extractReleaseNotes(changelog, '0.6.0'),
    '## [0.6.0] - 2026-10-01\n\n### Added\n\n- A\n',
  );
});
