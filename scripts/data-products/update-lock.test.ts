import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { computeNextLock, parseSyncRequest, updatePublicDataProductLock } from './update-lock';
import { knowledgeReleaseFixture } from './fixtures/knowledge-release';
import { parsePublicDataProductLock } from './lock-v1';

test('standard event, manual recovery and missed-dispatch reconciliation produce byte-identical locks', async () => {
  const f = knowledgeReleaseFixture();
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
  const recovery = await computeNextLock('reconcile', { product: f.lock.product }, f.transport);
  assert.equal(event.serialized, `${JSON.stringify(f.lock, null, 2)}\n`);
  assert.equal(event.serialized, recovery.serialized);
  assert.equal(event.serialized, manual.serialized);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-update-'));
  try {
    fs.mkdirSync(path.join(root, 'data-products'));
    const file = path.join(root, event.lockPath);
    const current = {
      ...f.lock,
      sourceRevision: '1'.repeat(40),
      releaseTag: `${f.lock.product}-${'1'.repeat(40)}`,
    };
    fs.writeFileSync(file, JSON.stringify(current));
    fs.writeFileSync(path.join(root, 'untouched'), 'sentinel');
    assert.equal(updatePublicDataProductLock(event, root), true);
    assert.equal(fs.readFileSync(file, 'utf8'), event.serialized);
    assert.equal(updatePublicDataProductLock(recovery, root), false);
    // Non-authoritative metadata / formatting do not create PR churn.
    const annotated = JSON.stringify({ ...f.lock, consumerMetadata: { note: 'retained' } });
    fs.writeFileSync(file, annotated);
    assert.equal(updatePublicDataProductLock(event, root), false);
    assert.equal(fs.readFileSync(file, 'utf8'), annotated);
    assert.equal(fs.readFileSync(path.join(root, 'untouched'), 'utf8'), 'sentinel');
    assert.deepEqual(fs.readdirSync(path.dirname(file)), ['knowledge-public-v1.lock.json']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('forged product/repository/source/tag and non-public products fail before network', async () => {
  for (const [key, value] of [
    ['product', 'unknown'],
    ['producer_repository', 'foreign/repo'],
    ['source_revision', 'f'.repeat(40)],
    ['release_tag', 'knowledge-public-v1-main'],
  ]) {
    const f = knowledgeReleaseFixture();
    await assert.rejects(
      computeNextLock(
        'event',
        { action: 'data-product-published', client_payload: { ...f.event, [key]: value } },
        f.transport,
      ),
    );
    assert.deepEqual(f.calls, []);
  }
  for (const product of ['digital-biome-private-infrastructure-v1', 'unknown']) {
    assert.throws(() => parseSyncRequest('reconcile', { product }), /Unknown public product/);
    assert.throws(
      () => parseSyncRequest('exact', { product, release_tag: `${product}-${'f'.repeat(40)}` }),
      /Unknown public product/,
    );
  }
});

test('materialized current Release event resolves to the exact committed knowledge lock', async (t) => {
  const runtime = new URL('../../.pds-runtime/knowledge-public-v1/', import.meta.url);
  if (!fs.existsSync(new URL('knowledge-public-v1.json', runtime)))
    return t.skip('Real Release is not materialized');
  const currentRaw = fs.readFileSync(
    new URL('../../data-products/knowledge-public-v1.lock.json', import.meta.url),
    'utf8',
  );
  const lock = parsePublicDataProductLock(JSON.parse(currentRaw));
  const artifact = fs.readFileSync(new URL(lock.artifact.name, runtime));
  const manifest = fs.readFileSync(new URL(lock.manifest.name, runtime));
  const fixture = knowledgeReleaseFixture();
  fixture.responses.clear();
  const base = `/repos/${lock.producerRepository}`;
  fixture.responses.set(`${base}/releases/tags/${lock.releaseTag}`, {
    ...fixture.release,
    tag_name: lock.releaseTag,
    assets: [
      {
        id: 11,
        name: lock.artifact.name,
        state: 'uploaded',
        size: artifact.length,
        digest: lock.artifact.sha256,
      },
      {
        id: 12,
        name: lock.manifest.name,
        state: 'uploaded',
        size: manifest.length,
        digest: lock.manifest.sha256,
      },
    ],
  });
  fixture.responses.set(`${base}/git/ref/tags/${lock.releaseTag}`, {
    ref: `refs/tags/${lock.releaseTag}`,
    object: { type: 'commit', sha: lock.sourceRevision },
  });
  fixture.downloads.set(11, artifact);
  fixture.downloads.set(12, manifest);
  const next = await computeNextLock(
    'event',
    {
      action: 'data-product-published',
      client_payload: {
        protocol_version: 1,
        product: lock.product,
        producer_repository: lock.producerRepository,
        source_revision: lock.sourceRevision,
        release_tag: lock.releaseTag,
        artifact: lock.artifact,
        manifest: lock.manifest,
        semantic_sha256: lock.semanticSha256,
      },
    },
    fixture.transport,
  );
  assert.equal(next.serialized, currentRaw);
});

test('validly shaped event still must match exact fetched publication digests', async () => {
  const f = knowledgeReleaseFixture();
  await assert.rejects(
    computeNextLock(
      'event',
      {
        action: 'data-product-published',
        client_payload: { ...f.event, semantic_sha256: `sha256:${'0'.repeat(64)}` },
      },
      f.transport,
    ),
    /semantic digest/,
  );
});
