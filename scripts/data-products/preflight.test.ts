import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectLocalPublicDataProducts, formatPreflightDiagnostics } from './preflight';
import { knowledgeReleaseFixture } from './fixtures/knowledge-release';
import { pdsReleaseFixture } from './fixtures/pds-release';
import { infraReleaseFixture } from './fixtures/infra-release';
import { sha256 } from './semantic-digest';

function fixtureDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'digital-biome-preflight-'));
  const fixtures = [knowledgeReleaseFixture(), pdsReleaseFixture(), infraReleaseFixture()];
  for (const fixture of fixtures) {
    fs.mkdirSync(path.join(root, 'data-products'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'data-products', `${fixture.lock.product}.lock.json`),
      JSON.stringify(fixture.lock, null, 2) + '\n',
    );
  }
  const materialize = () => {
    for (const fixture of fixtures) {
      const runtime = path.join(root, '.pds-runtime', fixture.lock.product);
      fs.mkdirSync(runtime, { recursive: true });
      fs.writeFileSync(path.join(runtime, fixture.lock.artifact.name), fixture.artifact);
      fs.writeFileSync(path.join(runtime, fixture.lock.manifest.name), fixture.manifest);
    }
  };
  return { root, fixtures, materialize };
}

test('clean checkout has three missing products and tells developer the exact recovery command', () => {
  const f = fixtureDir();
  try {
    const results = inspectLocalPublicDataProducts(f.root);
    assert.equal(results.length, 3);
    assert.ok(results.every((r) => r.state === 'missing'));
    const output = formatPreflightDiagnostics(results);
    assert.match(output, /knowledge-public-v1\.lock\.json/);
    assert.match(output, /infra-public-v2\.manifest\.json/);
    assert.match(output, /pds-catalog-v1\.json/);
    assert.match(output, /pnpm sync:data-products/);
    assert.doesNotMatch(output, /skip|--force/);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('exact local data products match all three committed locks without writing or network', () => {
  const f = fixtureDir();
  try {
    f.materialize();
    const before = fs
      .readdirSync(path.join(f.root, 'data-products'))
      .map((file) => fs.readFileSync(path.join(f.root, 'data-products', file), 'utf8'));
    const prior = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('preflight must never access the network');
    }) as typeof fetch;
    let results: ReturnType<typeof inspectLocalPublicDataProducts>;
    try {
      results = inspectLocalPublicDataProducts(f.root);
    } finally {
      globalThis.fetch = prior;
    }
    assert.ok(results.every((item) => item.state === 'ready'));
    assert.match(formatPreflightDiagnostics(results), /preflight:data-products=PASS/);
    assert.deepEqual(
      fs
        .readdirSync(path.join(f.root, 'data-products'))
        .map((file) => fs.readFileSync(path.join(f.root, 'data-products', file), 'utf8')),
      before,
    );
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('stale materialized artifact reports exact product, SHA and lock file rather than skipping', () => {
  const f = fixtureDir();
  try {
    f.materialize();
    const fixture = f.fixtures[0];
    const file = path.join(
      f.root,
      '.pds-runtime',
      fixture.lock.product,
      fixture.lock.artifact.name,
    );
    fs.writeFileSync(file, 'stale-ignored-cache');
    const results = inspectLocalPublicDataProducts(f.root);
    assert.equal(results[0].state, 'stale');
    assert.ok(results.slice(1).every((result) => result.state === 'ready'));
    const diagnostic = formatPreflightDiagnostics(results);
    assert.match(diagnostic, /knowledge-public-v1\.lock\.json/);
    assert.match(diagnostic, /knowledge-public-v1\.json/);
    assert.match(diagnostic, /sha256:/);
    assert.match(diagnostic, /pnpm sync:data-products/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'stale-ignored-cache');
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('missing manifest is distinct from a different-byte stale manifest', () => {
  const f = fixtureDir();
  try {
    f.materialize();
    const fixture = f.fixtures[2];
    const file = path.join(
      f.root,
      '.pds-runtime',
      fixture.lock.product,
      fixture.lock.manifest.name,
    );
    fs.rmSync(file);
    assert.equal(inspectLocalPublicDataProducts(f.root)[2].state, 'missing');
    fs.writeFileSync(file, '{}');
    assert.equal(inspectLocalPublicDataProducts(f.root)[2].state, 'stale');
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('malformed committed lock cannot be presented as a cache miss or rewritten', () => {
  const f = fixtureDir();
  try {
    f.materialize();
    const file = path.join(f.root, 'data-products', 'knowledge-public-v1.lock.json');
    const original = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...original, protocolVersion: 2 }));
    const results = inspectLocalPublicDataProducts(f.root);
    assert.equal(results[0].state, 'invalid-lock');
    assert.match(formatPreflightDiagnostics(results), /invalid committed lock/i);
    assert.match(fs.readFileSync(file, 'utf8'), /"protocolVersion":2/);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('forged valid-looking committed SHA for altered cached artifact still fails full local publication verification', () => {
  const f = fixtureDir();
  try {
    f.materialize();
    const fixture = f.fixtures[1];
    const artifact = Buffer.from('{"schemaVersion":1,"product":"pds-catalog-v1","payload":{}}');
    fs.writeFileSync(
      path.join(f.root, '.pds-runtime', fixture.lock.product, fixture.lock.artifact.name),
      artifact,
    );
    const lockFile = path.join(f.root, 'data-products', `${fixture.lock.product}.lock.json`);
    const original = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    fs.writeFileSync(
      lockFile,
      JSON.stringify({
        ...original,
        artifact: { ...original.artifact, sha256: sha256(artifact) },
      }),
    );
    const results = inspectLocalPublicDataProducts(f.root);
    assert.equal(results[1].state, 'invalid-publication');
    assert.match(formatPreflightDiagnostics(results), /publication integrity/i);
    assert.ok(results.filter((r) => r.state === 'ready').length === 2);
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});
