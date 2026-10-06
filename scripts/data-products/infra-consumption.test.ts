import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { computeNextLock, updatePublicDataProductLock } from './update-lock';
import { knowledgeReleaseFixture } from './fixtures/knowledge-release';
import { infraReleaseFixture } from './fixtures/infra-release';
import { pdsReleaseFixture } from './fixtures/pds-release';
import { sha256 } from './semantic-digest';

const fixtures = [knowledgeReleaseFixture, infraReleaseFixture, pdsReleaseFixture];

test('historical infra semantic no-op reconciles despite newer main with no Release for main', async () => {
  const f = infraReleaseFixture();
  const newerMain = 'ea906f56772eb380d1ec806fdc2bb3bc189b2a7f';
  f.responses.set(`${f.base}/commits/main`, { sha: newerMain });
  assert.equal(f.responses.has(`${f.base}/releases/tags/infra-public-v2-${newerMain}`), false);
  const next = await computeNextLock('reconcile', { product: 'infra-public-v2' }, f.transport);
  assert.deepEqual(next.publication.identity, f.lock);
  assert.equal(next.lockPath, 'data-products/infra-public-v2.lock.json');
  assert.ok(f.calls.every((call) => !call.includes('main') && !call.includes(newerMain)));
});

for (const fixture of fixtures) {
  test(`${fixture().lock.product}: event/manual/reconcile share strict identity and lock-only no-op replay`, async () => {
    const f = fixture();
    const event = await computeNextLock(
      'event',
      { action: 'data-product-published', client_payload: f.event },
      f.transport,
    );
    const exact = await computeNextLock(
      'exact',
      { product: f.lock.product, release_tag: f.lock.releaseTag },
      f.transport,
    );
    const reconciled = await computeNextLock('reconcile', { product: f.lock.product }, f.transport);
    assert.equal(event.serialized, exact.serialized);
    assert.equal(event.serialized, reconciled.serialized);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'infra-lock-'));
    try {
      fs.mkdirSync(path.join(root, 'data-products'));
      const file = path.join(root, event.lockPath);
      fs.writeFileSync(
        file,
        JSON.stringify({
          ...f.lock,
          sourceRevision: '1'.repeat(40),
          releaseTag: `${f.lock.product}-${'1'.repeat(40)}`,
        }),
      );
      const foreign =
        f.lock.product === 'infra-public-v2'
          ? knowledgeReleaseFixture().lock
          : infraReleaseFixture().lock;
      const foreignFile = path.join(root, 'data-products', `${foreign.product}.lock.json`);
      const foreignRaw = JSON.stringify(foreign);
      fs.writeFileSync(foreignFile, foreignRaw);
      assert.equal(updatePublicDataProductLock(event, root), true);
      assert.equal(fs.readFileSync(file, 'utf8'), exact.serialized);
      assert.equal(updatePublicDataProductLock(reconciled, root), false);
      const annotated = JSON.stringify({ ...f.lock, consumerMetadata: { note: 'retained' } });
      fs.writeFileSync(file, annotated);
      assert.equal(updatePublicDataProductLock(exact, root), false);
      assert.equal(fs.readFileSync(file, 'utf8'), annotated);
      assert.equal(fs.readFileSync(foreignFile, 'utf8'), foreignRaw);
      // A foreign-owned lock at the deterministic write path cannot be adopted.
      fs.writeFileSync(file, foreignRaw);
      assert.throws(
        () => updatePublicDataProductLock(event, root),
        /Current lock product mismatch/,
      );
      assert.equal(fs.readFileSync(file, 'utf8'), foreignRaw);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

for (const fixture of [infraReleaseFixture, pdsReleaseFixture]) {
  for (const fault of [
    'draft',
    'incomplete',
    'uploading',
    'wrong-target',
    'tampered',
    'manifest',
    'malformed-payload',
    'malformed-tag',
  ] as const) {
    test(`${fixture().lock.product} latest ${fault} publication fails closed rather than falling back`, async () => {
      const f = fixture();
      const older = {
        ...f.release,
        tag_name: `${f.lock.product}-${'1'.repeat(40)}`,
        published_at: '2026-09-01T00:00:00Z',
      };
      // Enumeration claims the latest was published; the exact-tag read must independently verify it.
      f.responses.set(`${f.base}/releases?per_page=100&page=1`, [
        structuredClone(f.release),
        older,
      ]);
      if (fault === 'draft') f.release.draft = true;
      if (fault === 'incomplete') f.release.assets.pop();
      if (fault === 'uploading') f.release.assets[0].state = 'new';
      if (fault === 'wrong-target') f.ref.object.sha = 'f'.repeat(40);
      if (fault === 'tampered') f.downloads.set(11, Buffer.alloc(f.artifact.length));
      if (fault === 'manifest') f.downloads.set(12, Buffer.alloc(f.manifest.length));
      if (fault === 'malformed-payload') {
        const bytes = Buffer.from(JSON.stringify({ ...f.projection, payload: null }));
        f.release.assets[0].size = bytes.length;
        f.release.assets[0].digest = sha256(bytes);
        f.downloads.set(11, bytes);
      }
      if (fault === 'malformed-tag')
        f.responses.set(`${f.base}/releases?per_page=100&page=1`, [
          { ...f.release, tag_name: `${f.lock.product}-main` },
          older,
        ]);
      await assert.rejects(computeNextLock('reconcile', { product: f.lock.product }, f.transport));
      assert.ok(!f.calls.some((call) => call.endsWith(`/tags/${older.tag_name}`)));
    });
  }
}

test('same immutable tag cannot be repinned to divergent bytes or semantic identity', async () => {
  for (const fixture of fixtures) {
    const f = fixture();
    const next = await computeNextLock('reconcile', { product: f.lock.product }, f.transport);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'immutable-lock-'));
    try {
      fs.mkdirSync(path.join(root, 'data-products'));
      const file = path.join(root, next.lockPath);
      const accepted = JSON.stringify({ ...f.lock, semanticSha256: `sha256:${'0'.repeat(64)}` });
      fs.writeFileSync(file, accepted);
      assert.throws(
        () => updatePublicDataProductLock(next, root),
        /Immutable Release identity drift/,
      );
      assert.equal(fs.readFileSync(file, 'utf8'), accepted);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

for (const fixture of [infraReleaseFixture, pdsReleaseFixture]) {
  test(`${fixture().lock.product} draft is not publication evidence; newest published time wins across pages`, async () => {
    const f = fixture();
    const older = {
      ...f.release,
      tag_name: `${f.lock.product}-${'1'.repeat(40)}`,
      published_at: '2026-09-01T00:00:00Z',
    };
    f.responses.set(
      `${f.base}/releases?per_page=100&page=1`,
      Array.from({ length: 100 }, () => older),
    );
    f.responses.set(`${f.base}/releases?per_page=100&page=2`, [
      {
        ...f.release,
        tag_name: `${f.lock.product}-${'f'.repeat(40)}`,
        draft: true,
        published_at: null,
      },
      f.release,
    ]);
    const result = await computeNextLock('reconcile', { product: f.lock.product }, f.transport);
    assert.deepEqual(result.publication.identity, f.lock);
  });

  test(`${fixture().lock.product} wrong producer/product events fail before network, and digest claims never authorize a mismatch`, async () => {
    for (const mutation of [
      { product: 'knowledge-public-v1' },
      { producer_repository: 'BakerSean168/thought-forest' },
      { product: 'digital-biome-private-infrastructure-v1' },
      { extra: true },
    ]) {
      const f = fixture();
      await assert.rejects(
        computeNextLock(
          'event',
          { action: 'data-product-published', client_payload: { ...f.event, ...mutation } },
          f.transport,
        ),
      );
      assert.deepEqual(f.calls, []);
    }
    for (const key of ['artifact', 'manifest', 'semantic_sha256'] as const) {
      const f = fixture();
      const invalid = `sha256:${'0'.repeat(64)}`;
      const value = key === 'semantic_sha256' ? invalid : { ...f.event[key], sha256: invalid };
      await assert.rejects(
        computeNextLock(
          'event',
          { action: 'data-product-published', client_payload: { ...f.event, [key]: value } },
          f.transport,
        ),
        /digest mismatch/,
      );
    }
  });
}

test('PDS reconciliation ignores newer producer main without a corresponding semantic Release', async () => {
  const f = pdsReleaseFixture();
  // Simulated semantic no-op main advance, not a claim about the current hosted main.
  const newerMain = 'f'.repeat(40);
  f.responses.set(`${f.base}/commits/main`, { sha: newerMain });
  assert.equal(f.responses.has(`${f.base}/releases/tags/pds-catalog-v1-${newerMain}`), false);
  const next = await computeNextLock('reconcile', { product: f.lock.product }, f.transport);
  assert.deepEqual(next.publication.identity, f.lock);
  assert.ok(f.calls.every((call) => !call.includes('main') && !call.includes(newerMain)));
});
