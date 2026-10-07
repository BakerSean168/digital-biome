import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createCandidate,
  createReleaseManifest,
  validateCandidate,
  validateReleaseManifest,
} from './manifest';

const products = ['knowledge-public-v1', 'pds-catalog-v1', 'infra-public-v2'];
function input() {
  return {
    gitSha: 'a'.repeat(40),
    ciRunId: '123',
    dataProducts: Object.fromEntries(
      products.map((product) => [
        product,
        JSON.parse(fs.readFileSync(`data-products/${product}.lock.json`, 'utf8')),
      ]),
    ),
    privateBindings: {
      'digital-biome-private-infrastructure-v1': JSON.parse(
        fs.readFileSync('data-products/digital-biome-private-infrastructure-v1.lock.json', 'utf8'),
      ),
    },
    artifact: {
      file: 'digital-biome-pages.tar.gz',
      sha256: `sha256:${'b'.repeat(64)}`,
      bytes: 100,
    },
  };
}

test('v5 preserves all three public product identities and independent private binding through promotion', () => {
  const source = input();
  const candidate = createCandidate(source, '2026-10-06T00:00:00Z');
  assert.equal(candidate.schema, 'digital-biome.candidate/v5');
  assert.deepEqual(validateCandidate(candidate), []);
  assert.deepEqual(candidate.dataProducts, source.dataProducts);
  const release = createReleaseManifest(candidate, '0.8.0', 'v0.8.0', '456');
  assert.equal(release.schema, 'digital-biome.release/v5');
  assert.deepEqual(release.dataProducts, source.dataProducts);
  assert.deepEqual(release.privateBindings, source.privateBindings);
  assert.deepEqual(release.artifact, source.artifact);
  assert.deepEqual(validateReleaseManifest(release), []);
  assert.equal('knowledge' in release, false);
});

test('v5 rejects missing, unexpected and substituted public products and private bindings', () => {
  for (const product of products) {
    const value = input();
    delete value.dataProducts[product];
    assert.throws(() => createCandidate(value), /dataProducts fields/);
  }
  const swapped = input();
  swapped.dataProducts['pds-catalog-v1'] = swapped.dataProducts['infra-public-v2'];
  assert.throws(() => createCandidate(swapped), /key\/identity mismatch/);
  const extra = input();
  extra.dataProducts.unknown = extra.dataProducts['knowledge-public-v1'];
  assert.throws(() => createCandidate(extra), /dataProducts fields/);
  assert.throws(
    () => createCandidate({ ...input(), privateBindings: {} }),
    /privateBindings fields/,
  );
  const forged = input();
  forged.dataProducts['pds-catalog-v1'].artifact.sha256 = 'unknown';
  assert.throws(() => createCandidate(forged), /sha256/);
});

test('candidate digest changes with each public input but ignores its generation time', () => {
  const source = input();
  const candidate = createCandidate(source, '2026-01-01');
  assert.equal(createCandidate(source, '2026-01-02').digest, candidate.digest);
  for (const product of products) {
    const changed = input();
    changed.dataProducts[product].semanticSha256 = `sha256:${'e'.repeat(64)}`;
    assert.notEqual(createCandidate(changed).digest, candidate.digest);
  }
  const altered = structuredClone(candidate);
  const data = altered.dataProducts as Record<string, { artifact: { sha256: string } }>;
  data['infra-public-v2'].artifact.sha256 = `sha256:${'e'.repeat(64)}`;
  assert.match(validateCandidate(altered).join(';'), /digest mismatch/);
});

test('the actual Candidate workflow records complete committed locks and a promotable immutable artifact', async () => {
  const { parse } = await import('yaml');
  const { spawnSync } = await import('node:child_process');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-v5-'));
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
