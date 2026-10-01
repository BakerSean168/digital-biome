import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANDIDATE_SCHEMA,
  RELEASE_SCHEMA,
  createCandidate,
  createReleaseManifest,
  releaseProvenanceMessage,
  validateCandidate,
  validateReleaseManifest,
} from './manifest.ts';
import { extractReleaseNotes, validateReleaseFiles } from './release-contract.ts';

const sha = 'a'.repeat(40);
const vaultSha = 'b'.repeat(40);
const hash = `sha256:${'c'.repeat(64)}`;

test('candidate and release preserve the exact deployable artifact identity', () => {
  const candidate = createCandidate(
    {
      gitSha: sha,
      ciRunId: '12345',
      vaultSha,
      assetIndexSha256: hash,
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
  assert.equal(release.gitSha, candidate.gitSha);
  assert.equal(
    releaseProvenanceMessage(release),
    [
      'digital-biome.release/v1',
      `release-manifest-digest: ${String(release.digest)}`,
      `artifact-sha256: ${hash}`,
      `candidate-manifest-digest: ${String(release.candidateManifestDigest)}`,
    ].join('\n'),
  );
});

test('candidate validation fails closed when artifact identity changes', () => {
  const candidate = createCandidate({
    gitSha: sha,
    ciRunId: '12345',
    vaultSha,
    assetIndexSha256: hash,
    artifact: {
      file: 'digital-biome-pages.tar.gz',
      sha256: hash,
      bytes: 123,
    },
  }) as Record<string, unknown>;

  candidate.artifact = {
    ...(candidate.artifact as Record<string, unknown>),
    sha256: `sha256:${'d'.repeat(64)}`,
  };

  assert.match(validateCandidate(candidate).join('; '), /candidate digest mismatch/);
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
