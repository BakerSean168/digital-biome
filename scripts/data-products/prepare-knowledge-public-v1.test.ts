import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareKnowledgePublicV1 } from './prepare-knowledge-public-v1';
import { knowledgeReleaseFixture } from './fixtures/knowledge-release';
import { semanticSha256, sha256 } from './semantic-digest';

test('late media verification failure leaves accepted runtime byte-identical and removes staging', async () => {
  const f = knowledgeReleaseFixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-atomic-'));
  const runtime = path.join(root, 'knowledge');
  try {
    await prepareKnowledgePublicV1(JSON.stringify(f.lock), runtime, f.transport);
    const acceptedArtifact = fs.readFileSync(path.join(runtime, f.lock.artifact.name));
    const acceptedMarker = fs.readFileSync(
      path.join(runtime, 'source/.pds-data-product-source.json'),
    );
    // Transport and semantic hashes are valid, but the existing owner materializer rejects media bytes.
    f.projection.payload.media.push({
      path: 'bad.png',
      mediaType: 'image/png',
      sha256: '0'.repeat(64),
      dataBase64: 'YQ==',
    });
    const badArtifact = Buffer.from(JSON.stringify(f.projection));
    f.downloads.set(11, badArtifact);
    f.release.assets[0].size = badArtifact.length;
    f.release.assets[0].digest = sha256(badArtifact);
    f.lock.artifact.sha256 = sha256(badArtifact);
    f.lock.semanticSha256 = semanticSha256(f.projection);
    await assert.rejects(
      prepareKnowledgePublicV1(JSON.stringify(f.lock), runtime, f.transport),
      /media digest mismatch/,
    );
    assert.deepEqual(fs.readFileSync(path.join(runtime, f.lock.artifact.name)), acceptedArtifact);
    assert.deepEqual(
      fs.readFileSync(path.join(runtime, 'source/.pds-data-product-source.json')),
      acceptedMarker,
    );
    assert.deepEqual(fs.readdirSync(root), ['knowledge']);
    f.release.assets[1].digest = `sha256:${'0'.repeat(64)}`;
    await assert.rejects(
      prepareKnowledgePublicV1(JSON.stringify(f.lock), runtime, f.transport),
      /digest mismatch/,
    );
    assert.deepEqual(fs.readFileSync(path.join(runtime, f.lock.artifact.name)), acceptedArtifact);
    assert.deepEqual(fs.readdirSync(root), ['knowledge']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
