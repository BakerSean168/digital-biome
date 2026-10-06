import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readPublicDataProductRelease } from './fetch-release';
import { knowledgeReleaseFixture } from './fixtures/knowledge-release';
import { createGitHubReleaseTransport } from './github-release-transport';

test('exact published tag verifies raw bytes and cleans isolated staging', async () => {
  const f = knowledgeReleaseFixture();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'release-test-'));
  try {
    const result = await readPublicDataProductRelease(
      { product: f.lock.product, releaseTag: f.lock.releaseTag, identity: f.lock },
      f.transport,
      tempRoot,
    );
    assert.deepEqual(result.identity, f.lock);
    assert.deepEqual(result.artifact.bytes, f.artifact);
    assert.deepEqual(fs.readdirSync(tempRoot), []);
    assert.ok(f.calls.every((call) => !call.includes('/heads/') && !call.includes('/main')));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

for (const fault of [
  'draft',
  'unpublished',
  'absent',
  'wrong-tag',
  'wrong-target',
  'missing',
  'extra',
  'duplicate',
  'digest',
  'bytes',
  'manifest',
] as const) {
  test(`exact Release rejects ${fault} and removes staging`, async () => {
    const f = knowledgeReleaseFixture();
    switch (fault) {
      case 'draft':
        f.release.draft = true;
        break;
      case 'unpublished':
        f.release.published_at = '';
        break;
      case 'absent':
        f.responses.clear();
        break;
      case 'wrong-tag':
        f.release.tag_name = `knowledge-public-v1-${'f'.repeat(40)}`;
        break;
      case 'wrong-target':
        f.ref.object.sha = 'f'.repeat(40);
        break;
      case 'missing':
        f.release.assets.pop();
        break;
      case 'extra':
        f.release.assets.push({ ...f.release.assets[0], id: 13, name: 'extra.json' });
        break;
      case 'duplicate':
        f.release.assets[1].name = f.release.assets[0].name;
        break;
      case 'digest':
        f.release.assets[0].digest = `sha256:${'0'.repeat(64)}`;
        break;
      case 'bytes':
        f.downloads.set(11, Buffer.alloc(f.artifact.length));
        break;
      case 'manifest':
        f.downloads.set(12, Buffer.alloc(f.manifest.length));
        break;
    }
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'release-failure-'));
    try {
      await assert.rejects(
        readPublicDataProductRelease(
          { product: f.lock.product, releaseTag: f.lock.releaseTag, identity: f.lock },
          f.transport,
          tempRoot,
        ),
      );
      assert.deepEqual(fs.readdirSync(tempRoot), []);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
}

test('dereferences annotated tags, ignores mutable target_commitish, rejects tree targets', async () => {
  const f = knowledgeReleaseFixture();
  const annotatedSha = 'a'.repeat(40);
  f.ref.object = { type: 'tag', sha: annotatedSha };
  const annotated = { sha: annotatedSha, object: { type: 'commit', sha: f.lock.sourceRevision } };
  f.responses.set(`/repos/${f.lock.producerRepository}/git/tags/${annotatedSha}`, annotated);
  assert.deepEqual(
    (
      await readPublicDataProductRelease(
        { product: f.lock.product, releaseTag: f.lock.releaseTag },
        f.transport,
      )
    ).identity,
    f.lock,
  );
  annotated.object.type = 'tree';
  await assert.rejects(
    readPublicDataProductRelease(
      { product: f.lock.product, releaseTag: f.lock.releaseTag },
      f.transport,
    ),
    /commit/,
  );
});

test('reconciliation selects publication time across pages, never producer main', async () => {
  const f = knowledgeReleaseFixture();
  const older = {
    ...f.release,
    tag_name: `knowledge-public-v1-${'a'.repeat(40)}`,
    published_at: '2026-09-01T00:00:00Z',
  };
  f.responses.set(
    `/repos/${f.lock.producerRepository}/releases?per_page=100&page=1`,
    Array.from({ length: 100 }, () => older),
  );
  f.responses.set(`/repos/${f.lock.producerRepository}/releases?per_page=100&page=2`, [f.release]);
  const latest = await readPublicDataProductRelease({ product: f.lock.product }, f.transport);
  assert.deepEqual(latest.identity, f.lock);
  assert.ok(f.calls.every((call) => !call.includes('main')));
  f.release.assets[0].digest = `sha256:${'0'.repeat(64)}`;
  await assert.rejects(
    readPublicDataProductRelease({ product: f.lock.product }, f.transport),
    /digest/,
  );
  f.release.tag_name = 'knowledge-public-v1-main';
  await assert.rejects(
    readPublicDataProductRelease({ product: f.lock.product }, f.transport),
    /exact product/,
  );
});

test('bounded transport rejects HTTP errors, oversized declared and streamed bodies', async () => {
  for (const response of [
    new Response('missing', { status: 404 }),
    new Response('data', { headers: { 'content-length': '100' } }),
    new Response('too large'),
  ]) {
    const transport = createGitHubReleaseTransport('test-token', async () => response);
    await assert.rejects(
      transport.download('/repos/owner/repo/releases/assets/1', 3),
      /HTTP 404|byte limit/,
    );
  }
});
