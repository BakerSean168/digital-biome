import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { preparePdsCatalogV1 } from './prepare-pds-catalog-v1';
import { pdsReleaseFixture, historicalPdsRevision } from './fixtures/pds-release';
import { semanticSha256, sha256 } from './semantic-digest';
import { computeNextLock, updatePublicDataProductLock } from './update-lock';
import { parsePdsCatalogV1 } from '../../src/domain/system/pds-catalog-v1';

// Independent pre-cutover fingerprints, verified against Release 402343236 and base 62bfdef.
const historicalArtifact =
  'sha256:8db2de75c98c058abb4ac558ded669d5b11b27e485396524e500e8c28db00196';
const historicalSemantic =
  'sha256:75a6ba96f26a55d55498b847d5e436ed39462537e3d24b61f07ca9984590dcd9';

test('historical Release materialization has byte/JSON/semantic parity with the pre-cutover tracked projection', async (t) => {
  const runtime = process.env.PDS_PARITY_RUNTIME ?? '.pds-runtime/pds-catalog-v1';
  const artifact = fs.readFileSync(path.join(runtime, 'pds-catalog-v1.json'));
  const manifest = fs.readFileSync(path.join(runtime, 'pds-catalog-v1.manifest.json'));
  if (JSON.parse(artifact.toString()).source.revision !== historicalPdsRevision)
    return t.skip(
      'Current lock advanced; replay with PDS_PARITY_RUNTIME pointing to the historical verified Release',
    );
  assert.equal(sha256(artifact), historicalArtifact);
  assert.equal(
    sha256(manifest),
    'sha256:f93a6427980e68fc04a52bee7c9de5e3191ad7a96875e6c6bbc57d4bebcae635',
  );
  const f = pdsReleaseFixture({ artifact, manifest });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pds-parity-'));
  try {
    const output = path.join(root, 'output.json');
    await preparePdsCatalogV1(
      JSON.stringify(f.lock),
      path.join(root, 'runtime'),
      f.transport,
      output,
    );
    const generated = fs.readFileSync(output);
    const current = fs.readFileSync('src/data/system/pds-catalog-v1.json');
    assert.equal(sha256(generated), historicalArtifact);
    assert.deepEqual(generated, current);
    assert.deepEqual(JSON.parse(generated.toString()), JSON.parse(current.toString()));
    assert.equal(semanticSha256(parsePdsCatalogV1(generated.toString())), historicalSemantic);
    assert.deepEqual(parsePdsCatalogV1(generated.toString()).payload.summary, {
      domainCount: 7,
      repositoryCount: 22,
      projectionCount: 3,
    });
    const event = await computeNextLock(
      'event',
      { action: 'data-product-published', client_payload: f.event },
      f.transport,
    );
    const manual = await computeNextLock(
      'exact',
      { product: f.lock.product, release_tag: f.lock.releaseTag },
      f.transport,
    );
    const reconcile = await computeNextLock('reconcile', { product: f.lock.product }, f.transport);
    assert.equal(event.serialized, manual.serialized);
    assert.equal(event.serialized, reconcile.serialized);
    const committed = fs.readFileSync('data-products/pds-catalog-v1.lock.json', 'utf8');
    assert.equal(event.serialized, committed);
    fs.mkdirSync(path.join(root, 'data-products'));
    fs.writeFileSync(path.join(root, event.lockPath), committed);
    assert.equal(updatePublicDataProductLock(reconcile, root), false);
    assert.equal(fs.readFileSync(path.join(root, event.lockPath), 'utf8'), committed);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('PDS prepare preserves exact producer bytes and is deterministic on replay', async () => {
  const f = pdsReleaseFixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pds-prepare-'));
  try {
    const runtime = path.join(root, 'runtime');
    const output = path.join(root, 'output.json');
    for (let i = 0; i < 2; i++) {
      const result = await preparePdsCatalogV1(
        JSON.stringify(f.lock),
        runtime,
        f.transport,
        output,
      );
      assert.deepEqual(result.identity, f.lock);
      assert.deepEqual(fs.readFileSync(output), f.artifact);
      assert.deepEqual(fs.readFileSync(path.join(runtime, f.lock.artifact.name)), f.artifact);
      assert.deepEqual(fs.readFileSync(path.join(runtime, f.lock.manifest.name)), f.manifest);
      assert.deepEqual(fs.readdirSync(root).sort(), ['output.json', 'runtime']);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

for (const fault of ['manifest', 'domain', 'semantic', 'source', 'output-install'] as const) {
  test(`PDS ${fault} failure preserves prior accepted runtime and read model`, async (t) => {
    const f = pdsReleaseFixture();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pds-failure-'));
    const runtime = path.join(root, 'runtime');
    const output = path.join(root, 'output.json');
    try {
      fs.mkdirSync(runtime);
      fs.writeFileSync(path.join(runtime, 'accepted'), 'previous runtime');
      fs.writeFileSync(output, 'previous read model');
      if (fault === 'manifest') f.downloads.set(12, Buffer.alloc(f.manifest.length));
      if (fault === 'semantic') f.lock.semanticSha256 = `sha256:${'0'.repeat(64)}`;
      if (fault === 'domain' || fault === 'source') {
        if (fault === 'domain') f.projection.payload.repositories[0].domainId = 'missing';
        else f.projection.source.revision = 'f'.repeat(40);
        const bytes = Buffer.from(JSON.stringify(f.projection));
        f.lock.artifact.sha256 = sha256(bytes);
        f.lock.semanticSha256 = semanticSha256(f.projection);
        f.release.assets[0].size = bytes.length;
        f.release.assets[0].digest = sha256(bytes);
        f.downloads.set(11, bytes);
      }
      if (fault === 'output-install') {
        const rename = fs.renameSync;
        t.mock.method(fs, 'renameSync', (from: fs.PathLike, to: fs.PathLike) => {
          if (to === output) {
            // Failure is genuinely late: the staged runtime has already been installed.
            assert.deepEqual(fs.readFileSync(path.join(runtime, f.lock.artifact.name)), f.artifact);
            throw new Error('Injected output rename failure');
          }
          rename(from, to);
        });
      }
      await assert.rejects(
        preparePdsCatalogV1(JSON.stringify(f.lock), runtime, f.transport, output),
      );
      assert.equal(fs.readFileSync(output, 'utf8'), 'previous read model');
      assert.equal(fs.readFileSync(path.join(runtime, 'accepted'), 'utf8'), 'previous runtime');
      assert.deepEqual(fs.readdirSync(root).sort(), ['output.json', 'runtime']);
      if (fault === 'output-install') {
        t.mock.restoreAll();
        await preparePdsCatalogV1(JSON.stringify(f.lock), runtime, f.transport, output);
        assert.deepEqual(fs.readFileSync(output), f.artifact);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
