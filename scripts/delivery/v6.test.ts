import { identityDigest } from './manifest-schema';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createCandidate,
  createReleaseManifest,
  releaseProvenanceMessage,
  validateCandidate,
  validateReleaseManifest,
} from './manifest';

const PUBLIC_PRODUCTS = ['knowledge-public-v1', 'infra-public-v2'] as const;
function input() {
  const lock = (product: string) =>
    JSON.parse(fs.readFileSync(`data-products/${product}.lock.json`, 'utf8'));
  return {
    gitSha: 'a'.repeat(40),
    ciRunId: '123',
    dataProducts: Object.fromEntries(PUBLIC_PRODUCTS.map((product) => [product, lock(product)])),
    privateBindings: {
      'digital-biome-private-infrastructure-v1': lock('digital-biome-private-infrastructure-v1'),
    },
    artifact: {
      file: 'digital-biome-pages.tar.gz',
      sha256: `sha256:${'b'.repeat(64)}`,
      bytes: 100,
    },
  };
}

test('v6 carries exactly two public identities and one private binding through the immutable release', () => {
  const source = input();
  const candidate = createCandidate(source, '2026-11-19T00:00:00.000Z');
  assert.equal(candidate.schema, 'digital-biome.candidate/v6');
  assert.deepEqual(
    Object.keys(candidate.dataProducts as object).sort(),
    [...PUBLIC_PRODUCTS].sort(),
  );
  assert.deepEqual(validateCandidate(candidate), []);
  const release = createReleaseManifest(candidate, '0.17.0', 'v0.17.0', '456');
  assert.equal(release.schema, 'digital-biome.release/v6');
  assert.deepEqual(validateReleaseManifest(release), []);
  assert.deepEqual(release.dataProducts, candidate.dataProducts);
  assert.deepEqual(release.privateBindings, candidate.privateBindings);
  assert.deepEqual(release.artifact, candidate.artifact);
  assert.match(releaseProvenanceMessage(release), /release-manifest-digest: sha256:/);
});

test('v6 rejects missing, foreign, substituted or additional producer identities', () => {
  for (const product of PUBLIC_PRODUCTS) {
    const changed = input();
    delete changed.dataProducts[product];
    assert.throws(() => createCandidate(changed), /dataProducts fields/);
  }
  const extra = input();
  extra.dataProducts['pds-catalog-v1'] = extra.dataProducts['knowledge-public-v1'];
  assert.throws(() => createCandidate(extra), /dataProducts fields/);
  const swapped = input();
  swapped.dataProducts['infra-public-v2'] = swapped.dataProducts['knowledge-public-v1'];
  assert.throws(() => createCandidate(swapped), /dataProducts key\/identity mismatch/);
  assert.throws(
    () => createCandidate({ ...input(), privateBindings: {} }),
    /privateBindings fields/,
  );
  assert.throws(() => createCandidate({ ...input(), knowledge: {} }), /candidate input fields/);
});

test('v6 rejects old schema manifests and unknown new schema fields, even with a valid digest', () => {
  const candidate = createCandidate(input());
  const release = createReleaseManifest(candidate, '0.17.0', 'v0.17.0', '456');
  for (const version of ['v3', 'v4', 'v5']) {
    assert.match(
      validateCandidate({
        ...candidate,
        schema: `digital-biome.candidate/${version}`,
        digest: identityDigest({ ...candidate, schema: `digital-biome.candidate/${version}` }),
      }).join(';'),
      /schema must be digital-biome.candidate\/v6/,
    );
    assert.match(
      validateReleaseManifest({
        ...release,
        schema: `digital-biome.release/${version}`,
        digest: identityDigest({ ...release, schema: `digital-biome.release/${version}` }),
      }).join(';'),
      /schema must be digital-biome.release\/v6/,
    );
  }
  assert.match(validateCandidate({ ...candidate, legacy: true }).join(';'), /candidate fields/);
  assert.match(validateReleaseManifest({ ...release, knowledge: {} }).join(';'), /release fields/);
});

test('v6 immutable identity digest tracks producer values but not generation time', () => {
  const baseline = createCandidate(input(), '2026-01-01');
  assert.equal(baseline.digest, createCandidate(input(), '2026-01-02').digest);
  for (const product of PUBLIC_PRODUCTS) {
    const changed = input();
    changed.dataProducts[product].semanticSha256 = `sha256:${'e'.repeat(64)}`;
    assert.notEqual(createCandidate(changed).digest, baseline.digest);
  }
  const tampered = structuredClone(baseline);
  (tampered.dataProducts as Record<string, any>)['infra-public-v2'].artifact.sha256 =
    `sha256:${'e'.repeat(64)}`;
  assert.match(validateCandidate(tampered).join(';'), /digest mismatch/);
});

test('CLI publishes and validates exact v6 manifests; old schemas fail closed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v6-delivery-'));
  const cli = path.resolve('scripts/delivery/manifest.ts');
  const execute = (...args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', cli, ...args], { encoding: 'utf8' });
  try {
    const inp = path.join(root, 'input.json');
    const cand = path.join(root, 'candidate.json');
    const rel = path.join(root, 'release.json');
    fs.writeFileSync(inp, JSON.stringify(input()));
    assert.equal(execute('candidate', '--input', inp, '--output', cand).status, 0);
    assert.equal(execute('validate', '--file', cand).status, 0);
    assert.equal(
      execute(
        'release',
        '--candidate',
        cand,
        '--version',
        '0.17.0',
        '--tag',
        'v0.17.0',
        '--candidate-run-id',
        '456',
        '--output',
        rel,
      ).status,
      0,
    );
    assert.equal(execute('validate', '--file', rel).status, 0);
    const forged = {
      ...JSON.parse(fs.readFileSync(rel, 'utf8')),
      schema: 'digital-biome.release/v5',
    };
    fs.writeFileSync(rel, JSON.stringify(forged));
    const denied = execute('validate', '--file', rel);
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /schema must be digital-biome.release\/v6/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the actual Candidate workflow records complete committed locks and a promotable immutable artifact', async () => {
  const { parse } = await import('yaml');
  const { spawnSync } = await import('node:child_process');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-v6-'));
  try {
    fs.cpSync('data-products', path.join(root, 'data-products'), { recursive: true });
    fs.cpSync('scripts', path.join(root, 'scripts'), { recursive: true });
    fs.symlinkSync(path.resolve('src'), path.join(root, 'src'));
    fs.copyFileSync('tsconfig.json', path.join(root, 'tsconfig.json'));
    fs.symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'));
    fs.copyFileSync('package.json', path.join(root, 'package.json'));
    fs.mkdirSync(path.join(root, 'dist'));
    fs.writeFileSync(path.join(root, 'dist/index.html'), 'immutable fixture');
    const workflow = parse(fs.readFileSync('.github/workflows/candidate-publish.yml', 'utf8'));
    const step = workflow.jobs['build-candidate'].steps.find(
      (s: { id?: string }) => s.id === 'identity',
    );
    const run = spawnSync('bash', ['-c', step.run], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        REVISION: 'a'.repeat(40),
        CI_RUN_ID: '123',
        GITHUB_OUTPUT: path.join(root, 'output'),
      },
    });
    assert.equal(run.status, 0, run.stderr + run.stdout);
    const candidate = JSON.parse(
      fs.readFileSync(path.join(root, 'reports/candidate/candidate-manifest.json'), 'utf8'),
    );
    assert.deepEqual(validateCandidate(candidate), []);
    assert.deepEqual(candidate.dataProducts, input().dataProducts);
    const release = createReleaseManifest(candidate, '0.8.0', 'v0.8.0', '456');
    assert.deepEqual(release.artifact, candidate.artifact);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('v6 refuses artifact extensions and malformed immutable identities', () => {
  const candidate = createCandidate(input());
  for (const artifact of [
    { ...(candidate.artifact as object), extra: true },
    { ...(candidate.artifact as object), bytes: 0 },
    { ...(candidate.artifact as object), sha256: 'unknown' },
    { ...(candidate.artifact as object), file: '../other.tar.gz' },
  ]) {
    const forged: Record<string, unknown> = { ...candidate, artifact };
    forged.digest = identityDigest(forged);
    assert.ok(validateCandidate(forged).length > 0);
  }
  assert.throws(
    () => createCandidate({ ...input(), artifact: { ...input().artifact, extra: true } }),
    /artifact fields/,
  );
  assert.throws(
    () =>
      releaseProvenanceMessage({
        ...createReleaseManifest(candidate, '0.17.0', 'v0.17.0', '456'),
        gitSha: 'bad',
      }),
    /Git SHA/,
  );
});
