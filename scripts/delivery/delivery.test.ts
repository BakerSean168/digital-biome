import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  CANDIDATE_SCHEMA,
  LEGACY_CANDIDATE_SCHEMA,
  LEGACY_RELEASE_SCHEMA,
  PREVIOUS_CANDIDATE_SCHEMA,
  PREVIOUS_RELEASE_SCHEMA,
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
const privateInfrastructureSourceSha = 'e'.repeat(40);
const hash = `sha256:${'c'.repeat(64)}`;
const manifestHash = `sha256:${'d'.repeat(64)}`;
const privateInfrastructureHash = `sha256:${'f'.repeat(64)}`;

function knowledge() {
  return {
    producerRepository: 'BakerSean168/thought-forest',
    sourceRevision: knowledgeSourceSha,
    releaseTag: `knowledge-public-v1-${knowledgeSourceSha}`,
    artifactSha256: hash,
    manifestSha256: manifestHash,
  };
}

function privateInfrastructure() {
  return {
    producerRepository: 'BakerSean168/personal-infrastructure',
    sourceRevision: privateInfrastructureSourceSha,
    contractPath: 'bindings/digital-biome/private-infrastructure-v1.json',
    sha256: privateInfrastructureHash,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function withDigest(value: Record<string, unknown>): Record<string, unknown> {
  const { digest: _digest, generatedAt: _generatedAt, ...identity } = value;
  return {
    ...value,
    digest: `sha256:${createHash('sha256')
      .update(JSON.stringify(canonicalize(identity)))
      .digest('hex')}`,
  };
}

function artifact() {
  return {
    file: 'digital-biome-pages.tar.gz',
    sha256: hash,
    bytes: 123,
  };
}

test('candidate and release preserve deployable, knowledge, and private runtime identities', () => {
  const candidate = createCandidate(
    {
      gitSha: sha,
      ciRunId: '12345',
      knowledge: knowledge(),
      privateInfrastructure: privateInfrastructure(),
      artifact: artifact(),
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
  assert.deepEqual(release.privateInfrastructure, candidate.privateInfrastructure);
  assert.equal(release.gitSha, candidate.gitSha);
  assert.equal(
    releaseProvenanceMessage(release),
    [
      'digital-biome.release/v3',
      `release-manifest-digest: ${String(release.digest)}`,
      `artifact-sha256: ${hash}`,
      `candidate-manifest-digest: ${String(release.candidateManifestDigest)}`,
    ].join('\n'),
  );
});

test('candidate validation fails closed when artifact, knowledge, or private runtime identity changes', () => {
  const candidate = createCandidate({
    gitSha: sha,
    ciRunId: '12345',
    knowledge: knowledge(),
    privateInfrastructure: privateInfrastructure(),
    artifact: artifact(),
  }) as Record<string, unknown>;

  candidate.artifact = {
    ...(candidate.artifact as Record<string, unknown>),
    sha256: `sha256:${'0'.repeat(64)}`,
  };
  assert.match(validateCandidate(candidate).join('; '), /candidate digest mismatch/);

  const changedKnowledgeCandidate = createCandidate({
    gitSha: sha,
    ciRunId: '12345',
    knowledge: knowledge(),
    privateInfrastructure: privateInfrastructure(),
    artifact: artifact(),
  }) as Record<string, unknown>;
  changedKnowledgeCandidate.knowledge = {
    ...(changedKnowledgeCandidate.knowledge as Record<string, unknown>),
    sourceRevision: '1'.repeat(40),
  };
  assert.match(
    validateCandidate(changedKnowledgeCandidate).join('; '),
    /releaseTag must equal|candidate digest mismatch/,
  );

  const changedPrivateCandidate = createCandidate({
    gitSha: sha,
    ciRunId: '12345',
    knowledge: knowledge(),
    privateInfrastructure: privateInfrastructure(),
    artifact: artifact(),
  }) as Record<string, unknown>;
  changedPrivateCandidate.privateInfrastructure = {
    ...(changedPrivateCandidate.privateInfrastructure as Record<string, unknown>),
    contractPath: 'bindings/digital-biome/mutable.json',
  };
  assert.match(
    validateCandidate(changedPrivateCandidate).join('; '),
    /privateInfrastructure\.contractPath|candidate digest mismatch/,
  );
});

test('v2 delivery manifests remain valid for rollback deployment', () => {
  const previousCandidate = withDigest({
    schema: PREVIOUS_CANDIDATE_SCHEMA,
    gitSha: sha,
    ciRunId: '12345',
    knowledge: knowledge(),
    artifact: artifact(),
    generatedAt: '2026-09-15T00:00:00.000Z',
  });

  assert.deepEqual(validateCandidate(previousCandidate), []);
  const previousRelease = createReleaseManifest(
    previousCandidate,
    '0.5.5',
    'v0.5.5',
    '67889',
    '2026-09-15T01:00:00.000Z',
  );
  assert.equal(previousRelease.schema, PREVIOUS_RELEASE_SCHEMA);
  assert.deepEqual(validateReleaseManifest(previousRelease), []);
  assert.deepEqual(previousRelease.knowledge, previousCandidate.knowledge);
  assert.equal('privateInfrastructure' in previousRelease, false);
});

test('legacy v1 delivery manifests remain valid for rollback deployment', () => {
  const legacyCandidate = withDigest({
    schema: LEGACY_CANDIDATE_SCHEMA,
    gitSha: sha,
    ciRunId: '12345',
    vaultSha: knowledgeSourceSha,
    assetIndexSha256: hash,
    artifact: artifact(),
    generatedAt: '2026-09-01T00:00:00.000Z',
  });

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
