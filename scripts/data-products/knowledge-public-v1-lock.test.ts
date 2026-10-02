import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import type { KnowledgePublicV1 } from './knowledge-public-v1';
import {
  parseKnowledgePublicV1Lock,
  verifyKnowledgePublicV1Artifact,
  verifyKnowledgePublicV1Manifest,
} from './knowledge-public-v1-lock';

function sha(raw: string): string {
  return `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;
}

const revision = '0123456789abcdef0123456789abcdef01234567';

function projection(): KnowledgePublicV1 {
  return {
    schemaVersion: 1,
    product: 'knowledge-public-v1',
    generated: true,
    editable: false,
    producer: 'pds://system/component/thought-forest',
    source: {
      repository: 'https://github.com/BakerSean168/thought-forest.git',
      revision,
    },
    payload: {
      notes: [],
      assets: [],
      tags: [],
      linkGraph: [],
      media: [],
    },
  };
}

function manifest() {
  return {
    apiVersion: 'pds/v1alpha1',
    kind: 'DataProductManifest',
    metadata: { id: 'knowledge-public-v1' },
    spec: {
      producer: { ref: 'pds://system/component/thought-forest' },
      contract: { name: 'knowledge-public', version: 'v1' },
      source: {
        repository: 'https://github.com/BakerSean168/thought-forest.git',
        revision,
      },
      artifact: {
        path: 'generated/knowledge-public-v1.json',
        mediaType: 'application/vnd.pds.knowledge-public-v1+json',
        generated: true,
        editable: false,
      },
    },
  };
}

function lockRaw(artifactRaw: string, manifestRaw: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    product: 'knowledge-public-v1',
    producerRepository: 'BakerSean168/thought-forest',
    sourceRevision: revision,
    releaseTag: `knowledge-public-v1-${revision}`,
    artifact: {
      name: 'knowledge-public-v1.json',
      sha256: sha(artifactRaw),
    },
    manifest: {
      name: 'knowledge-public-v1.manifest.json',
      sha256: sha(manifestRaw),
    },
  });
}

test('validates an immutable knowledge public lock and producer payloads', () => {
  const artifactRaw = `${JSON.stringify(projection())}\n`;
  const manifestRaw = `${JSON.stringify(manifest(), null, 2)}\n`;
  const lock = parseKnowledgePublicV1Lock(lockRaw(artifactRaw, manifestRaw));

  assert.equal(verifyKnowledgePublicV1Artifact(lock, artifactRaw).source.revision, revision);
  assert.doesNotThrow(() => verifyKnowledgePublicV1Manifest(lock, manifestRaw));
});

test('rejects transport drift and source revision drift', () => {
  const artifactRaw = `${JSON.stringify(projection())}\n`;
  const manifestRaw = `${JSON.stringify(manifest(), null, 2)}\n`;
  const lock = parseKnowledgePublicV1Lock(lockRaw(artifactRaw, manifestRaw));

  assert.throws(
    () => verifyKnowledgePublicV1Artifact(lock, `${artifactRaw}tampered`),
    /artifact digest mismatch/,
  );

  const changed = projection();
  changed.source.revision = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd';
  const changedRaw = `${JSON.stringify(changed)}\n`;
  const changedLock = parseKnowledgePublicV1Lock(lockRaw(changedRaw, manifestRaw));
  assert.throws(
    () => verifyKnowledgePublicV1Artifact(changedLock, changedRaw),
    /source revision mismatch/,
  );
});

test('rejects lock fields outside the consumer contract', () => {
  const artifactRaw = `${JSON.stringify(projection())}\n`;
  const manifestRaw = `${JSON.stringify(manifest(), null, 2)}\n`;
  const value = JSON.parse(lockRaw(artifactRaw, manifestRaw));
  value.mutableUrl = 'https://example.invalid/latest';

  assert.throws(() => parseKnowledgePublicV1Lock(JSON.stringify(value)), /fields mismatch/);
});
