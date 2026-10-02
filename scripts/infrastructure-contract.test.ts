import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

interface AssetLink {
  url?: string;
  privateRef?: string;
  kind?: string;
}

interface AssetItem {
  assetId: string;
  links?: AssetLink[];
  monitor?: { url?: string };
}

const PUBLIC_ENDPOINTS = {
  'svc-memoflow-dailyuse': 'https://memoflow.bakersean.top/',
} as const;

function loadAssetIndex(generatedRoot: string): AssetItem[] {
  const assetIndexPath = path.resolve(generatedRoot, 'knowledge-index', 'asset-index.json');
  assert.ok(fs.existsSync(assetIndexPath), `Missing upstream asset index: ${assetIndexPath}`);
  const parsed: unknown = JSON.parse(fs.readFileSync(assetIndexPath, 'utf8'));
  assert.ok(Array.isArray(parsed), 'Upstream asset index must be an array.');
  return parsed as AssetItem[];
}

function findAsset(assets: AssetItem[], assetId: string): AssetItem {
  const asset = assets.find((item) => item.assetId === assetId);
  assert.ok(asset, `Missing required infrastructure asset: ${assetId}`);
  return asset;
}

function urlsFor(asset: AssetItem): Set<string> {
  return new Set([
    ...(asset.links ?? []).flatMap((link) => (link.url ? [link.url] : [])),
    ...(asset.monitor?.url ? [asset.monitor.url] : []),
  ]);
}

test('producer-owned public projection keeps protected infrastructure links redacted', (t) => {
  const generatedRoot = path.resolve(
    process.cwd(),
    '.pds-runtime/knowledge-public-v1/source/generated',
  );
  if (!fs.existsSync(generatedRoot)) {
    t.skip('knowledge-public-v1 runtime source is not materialized in this execution');
    return;
  }

  const assets = loadAssetIndex(generatedRoot);
  let protectedRefs = 0;
  for (const asset of assets) {
    for (const link of asset.links ?? []) {
      if (!link.privateRef) continue;
      protectedRefs += 1;
      assert.equal(
        link.url,
        undefined,
        `${asset.assetId}:${link.privateRef} leaked a protected URL`,
      );
    }
  }
  assert.ok(protectedRefs > 0, 'expected protected link identities in the public projection');

  for (const [assetId, expectedUrl] of Object.entries(PUBLIC_ENDPOINTS)) {
    assert.ok(
      urlsFor(findAsset(assets, assetId)).has(expectedUrl),
      `${assetId} must preserve public endpoint ${expectedUrl}`,
    );
  }
});

test('the tracked subscription snapshot prevents an empty dashboard build', () => {
  const snapshotPath = path.resolve(process.cwd(), 'src/data/subscriptions.json');
  assert.ok(fs.existsSync(snapshotPath), `Missing subscription snapshot: ${snapshotPath}`);
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as {
    subscriptions?: unknown[];
  };
  assert.ok(
    Array.isArray(snapshot.subscriptions) && snapshot.subscriptions.length > 0,
    'The tracked subscription snapshot must contain at least one subscription.',
  );
});
