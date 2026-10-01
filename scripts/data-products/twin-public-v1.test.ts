import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  materializeTwinPublicV1,
  parseTwinPublicV1,
  twinProjectionSummary,
  type TwinPublicV1,
} from './twin-public-v1';

function fixture(): TwinPublicV1 {
  return {
    schemaVersion: 1,
    product: 'twin-public-v1',
    generated: true,
    editable: false,
    producer: 'pds://system/component/personal-twin',
    source: {
      repository: 'https://github.com/BakerSean168/personal-twin.git',
      revision: 'abcdef1234567890abcdef1234567890abcdef12',
    },
    payload: {
      spaces: [
        {
          id: 'room-public',
          title: 'Room',
          summary: 'Public presentation view',
          assetIds: ['asset-room-preview'],
        },
      ],
      bodyProfiles: [
        {
          id: 'body-public',
          title: 'Public avatar',
          assetIds: ['asset-body-preview'],
        },
      ],
      furnitureLayouts: [
        {
          id: 'layout-public',
          spaceId: 'room-public',
          title: 'Public layout',
          assetIds: ['asset-room-preview'],
        },
      ],
      assets: [
        {
          id: 'asset-room-preview',
          kind: 'image',
          path: 'room/preview.webp',
          mediaType: 'image/webp',
          sha256: 'a'.repeat(64),
          title: 'Room preview',
        },
        {
          id: 'asset-body-preview',
          kind: 'image',
          path: 'body/preview.webp',
          mediaType: 'image/webp',
          sha256: 'b'.repeat(64),
          title: 'Body preview',
        },
      ],
    },
  };
}

test('accepts the producer-owned twin public projection envelope', () => {
  const projection = parseTwinPublicV1(JSON.stringify(fixture()));
  assert.deepEqual(twinProjectionSummary(projection), {
    sourceRevision: 'abcdef1234567890abcdef1234567890abcdef12',
    spaces: 1,
    bodyProfiles: 1,
    furnitureLayouts: 1,
    assets: 2,
  });
});

test('fails closed on unexpected fields outside the public contract', () => {
  const raw = JSON.stringify(fixture()).replace(
    '"title":"Public avatar"',
    '"title":"Public avatar","unexpected":"value"',
  );
  assert.throws(() => parseTwinPublicV1(raw), /unexpected field/);
});

test('fails closed on dangling references and unsafe asset paths', () => {
  const missingAsset = fixture();
  missingAsset.payload.spaces[0].assetIds = ['missing'];
  assert.throws(() => parseTwinPublicV1(JSON.stringify(missingAsset)), /unknown asset/);

  const badPath = fixture();
  badPath.payload.assets[0].path = '../private/preview.webp';
  assert.throws(
    () => parseTwinPublicV1(JSON.stringify(badPath)),
    /normalized relative POSIX path/,
  );
});

test('fails closed on provenance drift and invalid asset digests', () => {
  const wrongRepository = fixture();
  wrongRepository.source.repository = 'https://example.invalid/twin.git';
  assert.throws(
    () => parseTwinPublicV1(JSON.stringify(wrongRepository)),
    /source provenance is invalid/,
  );

  const badDigest = fixture();
  badDigest.payload.assets[0].sha256 = 'not-a-digest';
  assert.throws(
    () => parseTwinPublicV1(JSON.stringify(badDigest)),
    /lowercase SHA-256 digest/,
  );
});

test('materializes a validated twin projection without changing its envelope', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'twin-public-v1-consumer-'));
  const output = path.join(root, 'twin-public-v1.json');
  try {
    const projection = parseTwinPublicV1(JSON.stringify(fixture()));
    materializeTwinPublicV1(projection, output);
    const materialized = parseTwinPublicV1(fs.readFileSync(output, 'utf8'));
    assert.deepEqual(materialized, projection);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
