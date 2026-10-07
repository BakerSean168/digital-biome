import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  parseInfraPublicV2Lock,
  verifyInfraPublicV2Artifact,
  verifyInfraPublicV2Manifest,
} from './infra-public-v2-lock';

const lockPath = 'data-products/infra-public-v2.lock.json';
const runtimeRoot = '.pds-runtime/infra-public-v2';

test('tracked infra-public-v2 lock has canonical producer identity', () => {
  const lock = parseInfraPublicV2Lock(fs.readFileSync(lockPath, 'utf8'));
  assert.equal(lock.protocolVersion, 1);
  assert.match(lock.semanticSha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(lock.producerRepository, 'BakerSean168/personal-infrastructure');
  const { protocolVersion: _protocol, semanticSha256: _semantic, ...legacy } = lock;
  assert.throws(() => parseInfraPublicV2Lock(JSON.stringify({ ...legacy, schemaVersion: 1 })));
  assert.equal(lock.releaseTag, `infra-public-v2-${lock.sourceRevision}`);
});

test('materialized infra-public-v2 release matches the tracked lock when available', (t) => {
  const artifactPath = `${runtimeRoot}/infra-public-v2.json`;
  const manifestPath = `${runtimeRoot}/infra-public-v2.manifest.json`;
  if (!fs.existsSync(artifactPath) || !fs.existsSync(manifestPath)) {
    t.skip('infra-public-v2 release is not materialized in this execution');
    return;
  }

  const lock = parseInfraPublicV2Lock(fs.readFileSync(lockPath, 'utf8'));
  const projection = verifyInfraPublicV2Artifact(lock, fs.readFileSync(artifactPath, 'utf8'));
  verifyInfraPublicV2Manifest(lock, fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(projection.payload.resources.length > 0);
  assert.ok(projection.payload.connections.length > 0);
});
