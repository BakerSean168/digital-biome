import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCandidate } from './manifest';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-resolve-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  fs.cpSync('data-products', path.join(root, 'data-products'), { recursive: true });
  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('add', 'data-products');
  git('commit', '-qm', 'deployed');
  const file = path.join(root, 'data-products/knowledge-public-v1.lock.json');
  const lock = JSON.parse(fs.readFileSync(file, 'utf8'));
  lock.semanticSha256 = `sha256:${'c'.repeat(64)}`;
  fs.writeFileSync(file, JSON.stringify(lock));
  git('add', 'data-products');
  git('commit', '-qm', 'content');
  const sha = git('rev-parse', 'HEAD');
  const archive = Buffer.from('immutable Pages archive');
  const read = (p: string) =>
    JSON.parse(fs.readFileSync(path.join(root, `data-products/${p}.lock.json`), 'utf8'));
  const candidate = createCandidate({
    gitSha: sha,
    ciRunId: '123',
    dataProducts: Object.fromEntries(
      ['knowledge-public-v1', 'pds-catalog-v1', 'infra-public-v2'].map((p) => [p, read(p)]),
    ),
    privateBindings: {
      'digital-biome-private-infrastructure-v1': read('digital-biome-private-infrastructure-v1'),
    },
    artifact: {
      file: 'digital-biome-pages.tar.gz',
      sha256: `sha256:${createHash('sha256').update(archive).digest('hex')}`,
      bytes: archive.length,
    },
  });
  const repo = { full_name: 'BakerSean168/digital-biome' };
  const data = {
    sha,
    candidate,
    archive: archive.toString(),
    artifactSize: 1024,
    run: {
      repository: repo,
      name: 'Publish Main Candidate',
      path: '.github/workflows/candidate-publish.yml',
      head_branch: 'main',
      event: 'workflow_run',
      conclusion: 'success',
    },
    ci: {
      repository: repo,
      path: '.github/workflows/check.yml',
      name: 'CI',
      head_sha: sha,
      head_branch: 'main',
      event: 'workflow_dispatch',
      conclusion: 'success',
    },
  };
  fs.mkdirSync(path.join(root, 'bin'));
  fs.writeFileSync(
    path.join(root, 'bin/gh'),
    `#!/usr/bin/env node
const fs = require('node:fs'), p = require('node:path');
const d = JSON.parse(fs.readFileSync('fixture.json','utf8')), args = process.argv.slice(2), route = args[1];
if (args[0] === 'api') {
 let out;
 if (route.endsWith('/actions/runs/456')) out=d.run;
 else if (route.endsWith('/artifacts?per_page=100')) out={total_count:1,artifacts:[{name:'candidate-'+d.sha,expired:false,size_in_bytes:d.artifactSize}]};
 else if (route.endsWith('/actions/runs/123')) out=d.ci;
 else if (route.endsWith('/git/ref/heads/main')) out={object:{sha:d.sha}};
 else throw new Error('unexpected API');
 process.stdout.write(JSON.stringify(out));
} else if (args[0] === 'run' && args[1] === 'download') {
 fs.mkdirSync('reports/content/reports/candidate',{recursive:true});
 fs.writeFileSync('reports/content/reports/candidate/candidate-manifest.json',JSON.stringify(d.candidate));
 fs.writeFileSync('reports/content/digital-biome-pages.tar.gz',d.archive);
} else throw new Error('unexpected command');
`,
    { mode: 0o755 },
  );
  function run() {
    fs.writeFileSync(path.join(root, 'fixture.json'), JSON.stringify(data));
    return spawnSync(
      process.execPath,
      ['--import', 'tsx', path.resolve('scripts/delivery/content-candidate.ts'), 'resolve'],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 30_000,
        env: {
          ...process.env,
          PATH: path.join(root, 'bin') + ':' + process.env.PATH,
          CANDIDATE_RUN_ID: '456',
          GITHUB_OUTPUT: path.join(root, 'output'),
        },
      },
    );
  }
  fs.symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'));
  return { root, data, run };
}

test('content resolver accepts a verified latest-main lock-only Candidate from dispatched CI', () => {
  const f = fixture();
  try {
    const run = f.run();
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(fs.readFileSync(path.join(f.root, 'output'), 'utf8'), /eligible=true/);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('content resolver rejects stale, failed, substituted CI and artifact evidence', () => {
  for (const kind of [
    'workflow',
    'branch',
    'ci-sha',
    'ci-failure',
    'ci-path',
    'archive',
    'manifest',
    'size',
  ]) {
    const f = fixture();
    try {
      if (kind === 'workflow') f.data.run.path = '.github/workflows/attacker.yml';
      if (kind === 'branch') f.data.run.head_branch = 'feature';
      if (kind === 'ci-sha') f.data.ci.head_sha = 'b'.repeat(40);
      if (kind === 'ci-failure') f.data.ci.conclusion = 'failure';
      if (kind === 'ci-path') f.data.ci.path = '.github/workflows/other.yml';
      if (kind === 'size') f.data.artifactSize = 300 * 1024 * 1024;
      if (kind === 'archive') f.data.archive = 'tampered';
      if (kind === 'manifest') f.data.candidate.digest = `sha256:${'d'.repeat(64)}`;
      const run = f.run();
      assert.notEqual(run.status, 0, kind);
      assert.equal(fs.existsSync(path.join(f.root, 'output')), false, kind);
    } finally {
      fs.rmSync(f.root, { recursive: true, force: true });
    }
  }
});

test('Pages archives are hashed incrementally within the declared byte ceiling', async () => {
  const { archiveDigest } = await import('./archive-digest');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-bound-'));
  const file = path.join(root, 'archive');
  try {
    fs.writeFileSync(file, 'abc');
    assert.deepEqual(archiveDigest(file, 3), {
      bytes: 3,
      sha256: 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });
    assert.throws(() => archiveDigest(file, 2), /size limit/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
