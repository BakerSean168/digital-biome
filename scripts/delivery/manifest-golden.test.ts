import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { infraReleaseFixture } from '../data-products/fixtures/infra-release';
import { knowledgeReleaseFixture } from '../data-products/fixtures/knowledge-release';
import { pdsReleaseFixture } from '../data-products/fixtures/pds-release';
import {
  createCandidate,
  createReleaseManifest,
  releaseProvenanceMessage,
  validateCandidate,
  validateReleaseManifest,
} from './manifest';

// Frozen v3/v4/v5 golden manifests. Any change to canonical JSON bytes, key order,
// digest input or accepted schema breaks immutable Release rollback and must fail here.
const AT = 'Sun 2026-11-01 8:00 AM CST (UTC+08:00)';
const sha = (c: string) => c.repeat(40);
const digest = (c: string) => `sha256:${c.repeat(64)}`;
const artifact = { file: 'digital-biome-pages.tar.gz', sha256: digest('c'), bytes: 123 };
const knowledge = {
  producerRepository: 'BakerSean168/thought-forest',
  sourceRevision: sha('b'),
  releaseTag: `knowledge-public-v1-${sha('b')}`,
  artifactSha256: digest('d'),
  manifestSha256: digest('e'),
};
const publicInfrastructure = {
  producerRepository: 'BakerSean168/personal-infrastructure',
  sourceRevision: sha('e'),
  releaseTag: `infra-public-v2-${sha('e')}`,
  artifactSha256: digest('1'),
  manifestSha256: digest('2'),
};
const privateInfrastructure = {
  producerRepository: 'BakerSean168/personal-infrastructure',
  sourceRevision: sha('f'),
  contractPath: 'bindings/digital-biome/private-infrastructure-v1.json',
  sha256: digest('3'),
};
const privateBinding = {
  schemaVersion: 1,
  product: 'digital-biome-private-infrastructure-v1',
  ...privateInfrastructure,
};

function canonicalDigest(value: Record<string, unknown>): string {
  const canonicalize = (input: unknown): unknown =>
    Array.isArray(input)
      ? input.map(canonicalize)
      : input && typeof input === 'object'
        ? Object.fromEntries(
            Object.entries(input as Record<string, unknown>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, nested]) => [key, canonicalize(nested)]),
          )
        : input;
  const { digest: _d, generatedAt: _g, ...identity } = value;
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(canonicalize(identity)))
    .digest('hex')}`;
}

function legacyCandidate(schema: string, fields: Record<string, unknown>) {
  const value: Record<string, unknown> = {
    schema,
    gitSha: sha('a'),
    ciRunId: '12345',
    ...fields,
    artifact,
    generatedAt: AT,
  };
  value.digest = canonicalDigest(value);
  return value;
}

function goldens() {
  const v3 = legacyCandidate('digital-biome.candidate/v3', { knowledge, privateInfrastructure });
  const v4 = legacyCandidate('digital-biome.candidate/v4', {
    knowledge,
    publicInfrastructure,
    privateInfrastructure,
  });
  const v5 = createCandidate(
    {
      gitSha: sha('a'),
      ciRunId: '12345',
      dataProducts: Object.fromEntries(
        [knowledgeReleaseFixture(), pdsReleaseFixture(), infraReleaseFixture()].map((f) => [
          f.lock.product,
          f.lock,
        ]),
      ),
      privateBindings: { [privateBinding.product]: privateBinding },
      artifact,
    },
    AT,
  );
  const release = (candidate: Record<string, unknown>) =>
    createReleaseManifest(candidate, '1.2.3', 'v1.2.3', '67890', AT);
  return {
    'candidate/v3': v3,
    'candidate/v4': v4,
    'candidate/v5': v5,
    'release/v3': release(v3),
    'release/v4': release(v4),
    'release/v5': release(v5),
  };
}

const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const bytesSha = (text: string) => createHash('sha256').update(text).digest('hex');

function forgeries() {
  const g = goldens();
  const tamperedArtifact = (v: Record<string, unknown>) => ({
    ...v,
    artifact: { ...artifact, sha256: digest('9') },
  });
  return {
    'candidate/v3 tampered artifact': validateCandidate(tamperedArtifact(g['candidate/v3'])),
    'candidate/v4 missing publicInfrastructure': validateCandidate({
      ...g['candidate/v4'],
      publicInfrastructure: undefined,
    }),
    'candidate/v5 legacy duplicate': validateCandidate({ ...g['candidate/v5'], knowledge }),
    'candidate unknown schema': validateCandidate({
      ...g['candidate/v5'],
      schema: 'digital-biome.candidate/v6',
    }),
    'release/v3 tampered artifact': validateReleaseManifest(tamperedArtifact(g['release/v3'])),
    'release/v4 bad tag': validateReleaseManifest({ ...g['release/v4'], tag: 'v9.9.9' }),
    'release/v5 tampered artifact': validateReleaseManifest(tamperedArtifact(g['release/v5'])),
    'release unknown schema': validateReleaseManifest({
      ...g['release/v5'],
      schema: 'digital-biome.release/v6',
    }),
  };
}

const GOLDEN = {
  'candidate/v3': [
    'sha256:d5962e8ae437754db79317edf84408c5ab6c59ecd7c3a5f83496faf5065fb090',
    'f5d10944fc6a64bd8d18573aea7c2d9bb8a6b9e9d9827c32f7b4b3192be1ed87',
  ],
  'candidate/v4': [
    'sha256:8f2d92ec63f22ecffd7fddaafb40c917cc424900e119917d54f6a0723d5188de',
    '1f35b16c5281cc82305d16e9e5fbb3a960aceb2451e514f5c96b9fb342a199e7',
  ],
  'candidate/v5': [
    'sha256:10c2eed3f6da32186c4eea47d1c8599e644463e8a595c972fa97c463d7ea78f5',
    '2cedded0deb1023102980e3a61ce6a40a4b72bcc0654ca85548a27a184423752',
  ],
  'release/v3': [
    'sha256:b705e3931c2f8cd0122063c6272038dc85733feec720a7e9504d23050c117bc5',
    '2c5c558a3eeb2b49891ca0355ef0a781926f2f5e123600b32d028b1902d8dfd3',
  ],
  'release/v4': [
    'sha256:0bf37cb16da07000700445cb2ba3997c63892ab547024557dee8d77924d33e3a',
    'aed354e46501dee00aca1a3f66f72d9bec483aa3c4621e6c2fdef87e6c31b782',
  ],
  'release/v5': [
    'sha256:762a88a026548572032c605b5487be239ca73b5e431278de4cfe0cb143102174',
    '87fcb00c2e150caa4cb32f7f44a283cee1be831f349cb6cadf0fa627fc8505e0',
  ],
} as const;

const digestMismatch = (label: string, expected: string) =>
  `${label} digest mismatch: expected sha256:${expected}`;
const LEGACY_SHAPE_ERRORS = [
  'knowledge must be an object',
  'publicInfrastructure must be an object',
  'privateInfrastructure must be an object',
];
const FORGERY_ERRORS = {
  'candidate/v3 tampered artifact': [
    digestMismatch('candidate', '38c2a555605e0d9d9393a93bf7836ab8a0ee6ead18ec935f580b5b313a159876'),
  ],
  'candidate/v4 missing publicInfrastructure': [
    'publicInfrastructure must be an object',
    digestMismatch('candidate', 'd67fa9d8295dc8b3467168dac4a46322e07a5584a96a1dcce67853a3ec0dc01e'),
  ],
  'candidate/v5 legacy duplicate': [
    'v5 must not duplicate product identities in legacy fields',
    digestMismatch('candidate', 'b4ccb12b8c3c4fde6e8dcdb1cfa9c31149045481335fbd8d11c74b515cf5bdd6'),
  ],
  'candidate unknown schema': [
    'schema must be digital-biome.candidate/v5 or an accepted rollback schema',
    ...LEGACY_SHAPE_ERRORS,
    digestMismatch('candidate', '72755169e6fc8a7908863bd9b9bcf3c84805677d64ab78cf02933598a517dc5e'),
  ],
  'release/v3 tampered artifact': [
    digestMismatch('release', 'a5eb8512602e11eb9a93bdbe9e2b5daaea89f83b5abe318f2f0e000f1f36c01c'),
  ],
  'release/v4 bad tag': [
    'tag must equal v<version>',
    digestMismatch('release', 'e61fd93b5e92700625b07ab7f2930b3ccb69fba3aebf126e46c1d4f86de5be4e'),
  ],
  'release/v5 tampered artifact': [
    digestMismatch('release', 'db707fe79bf2027d4c14b32a86f6f8cb6c30bc8867a1d20ffb49faa052f88cc2'),
  ],
  'release unknown schema': [
    'schema must be digital-biome.release/v5 or an accepted rollback schema',
    ...LEGACY_SHAPE_ERRORS,
    digestMismatch('release', '832b6e330263fcf8f427d27945c43fa6355831b012677b2908dc5a9e56013e29'),
  ],
};

test('v3/v4/v5 candidate and release manifests keep byte-identical JSON and digests', () => {
  const values = goldens();
  for (const [name, [expectedDigest, expectedBytes]] of Object.entries(GOLDEN)) {
    const value = values[name as keyof typeof GOLDEN];
    assert.equal(value.digest, expectedDigest, name);
    assert.equal(bytesSha(serialize(value)), expectedBytes, name);
    const validate = name.startsWith('candidate/') ? validateCandidate : validateReleaseManifest;
    assert.deepEqual(validate(value), [], name);
  }
  assert.equal(
    releaseProvenanceMessage(values['release/v5']),
    [
      'digital-biome.release/v5',
      `release-manifest-digest: ${GOLDEN['release/v5'][0]}`,
      `artifact-sha256: ${artifact.sha256}`,
      `candidate-manifest-digest: ${GOLDEN['candidate/v5'][0]}`,
    ].join('\n'),
  );
});

test('forged v3/v4/v5 manifests keep the exact rejection errors', () => {
  assert.deepEqual(forgeries(), FORGERY_ERRORS);
});

test('CLI entrypoint and flags used by the release workflows are unchanged', () => {
  const cli = path.join(import.meta.dirname, 'manifest.ts');
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], { encoding: 'utf8' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-manifest-cli-'));
  try {
    const values = goldens();
    for (const [name, value] of Object.entries(values)) {
      const file = path.join(dir, `${name.replace('/', '-')}.json`);
      fs.writeFileSync(file, serialize(value));
      const result = run('validate', '--file', file);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, `DELIVERY_MANIFEST=PASS schema=${String(value.schema)}\n`);
    }
    const releaseFile = path.join(dir, 'release-v5.json');
    assert.equal(
      run('provenance', '--file', releaseFile).stdout,
      `${releaseProvenanceMessage(values['release/v5'])}\n`,
    );

    const { schema: _s, digest: _d, generatedAt: _g, ...input } = values['candidate/v5'];
    const inputFile = path.join(dir, 'input.json');
    const candidateFile = path.join(dir, 'out', 'candidate.json');
    fs.writeFileSync(inputFile, JSON.stringify(input));
    const candidate = run('candidate', '--input', inputFile, '--output', candidateFile);
    assert.equal(candidate.stdout, `CANDIDATE_MANIFEST=PASS digest=${GOLDEN['candidate/v5'][0]}\n`);
    const releaseOut = path.join(dir, 'out', 'release.json');
    const release = run(
      'release',
      '--candidate',
      candidateFile,
      '--version',
      '1.2.3',
      '--tag',
      'v1.2.3',
      '--candidate-run-id',
      '67890',
      '--output',
      releaseOut,
    );
    assert.equal(release.stdout, `RELEASE_MANIFEST=PASS digest=${GOLDEN['release/v5'][0]}\n`);

    const forged = path.join(dir, 'forged.json');
    fs.writeFileSync(forged, serialize({ ...values['release/v4'], tag: 'v9.9.9' }));
    const rejected = run('validate', '--file', forged);
    assert.equal(rejected.status, 1);
    assert.equal(
      rejected.stderr,
      `delivery manifest failed: ${FORGERY_ERRORS['release/v4 bad tag'].join('; ')}\n`,
    );
    const usage = run('unknown');
    assert.equal(usage.status, 1);
    assert.match(usage.stderr, /usage: manifest\.ts <candidate\|release\|validate\|provenance>/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
