import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { notesConfig } from '../notes.config';
import { buildPrivateInfrastructurePayload } from './export-private-infrastructure';

interface AssetLink {
  label: string;
  url: string;
  kind?: string;
  visibility?: 'public' | 'private' | 'internal';
}

interface AssetItem {
  assetId: string;
  links?: AssetLink[];
  monitor?: { url?: string };
}

const EXPECTED_ENDPOINTS = {
  'svc-homepage-dashboard': 'https://homepage.bakersean.top/',
  'svc-nezha-panel': 'https://nezha.bakersean.top/',
  'svc-sub-store': 'https://admin.bakersean.top/',
  'svc-memoflow-dailyuse': 'https://memoflow.bakersean.top/',
} as const;

const FORBIDDEN_HOSTNAMES = [
  'status.bakersean.top',
  'api.bakersean.top',
  'substore.bakersean.top',
] as const;

const SHOWCASE_HOSTS = [
  'host-azure-hk-vps',
  'host-aliyun-chengdu-dailyuse-vps',
  'host-azure-japan-singbox-vps',
  'host-azure-korea-singbox-vps',
  'host-oracle-osaka-amd-proxy-vps',
  'host-oracle-osaka-arm-development-vps',
] as const;

function loadAssets(): AssetItem[] {
  const assetIndexPath = path.resolve(
    process.cwd(),
    notesConfig.upstream.generatedPath,
    'knowledge-index',
    'asset-index.json',
  );
  assert.ok(fs.existsSync(assetIndexPath), `Missing upstream asset index: ${assetIndexPath}`);
  const parsed: unknown = JSON.parse(fs.readFileSync(assetIndexPath, 'utf8'));
  assert.ok(Array.isArray(parsed), 'Upstream asset index must be an array.');
  return parsed as AssetItem[];
}

function findAsset(assets: AssetItem[], assetId: string): AssetItem {
  const asset = assets.find(item => item.assetId === assetId);
  assert.ok(asset, `Missing required infrastructure asset: ${assetId}`);
  return asset;
}

test('infrastructure assets expose exactly the four authoritative service endpoints', () => {
  const assets = loadAssets();
  const serialized = JSON.stringify(assets);

  for (const hostname of FORBIDDEN_HOSTNAMES) {
    assert.ok(!serialized.includes(hostname), `Forbidden legacy hostname remains in asset index: ${hostname}`);
  }

  for (const [assetId, expectedUrl] of Object.entries(EXPECTED_ENDPOINTS)) {
    const asset = findAsset(assets, assetId);
    const urls = new Set([
      ...(asset.links ?? []).map(link => link.url),
      ...(asset.monitor?.url ? [asset.monitor.url] : []),
    ]);
    assert.ok(urls.has(expectedUrl), `${assetId} must contain ${expectedUrl}`);
  }
});

test('the tracked subscription snapshot prevents an empty dashboard build', () => {
  const snapshotPath = path.resolve(process.cwd(), 'src/data/subscriptions.json');
  assert.ok(fs.existsSync(snapshotPath), `Missing subscription snapshot: ${snapshotPath}`);
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { subscriptions?: unknown[] };
  assert.ok(
    Array.isArray(snapshot.subscriptions) && snapshot.subscriptions.length > 0,
    'The tracked subscription snapshot must contain at least one subscription.',
  );
});

test('private payload uses stable asset refs and one explicit SSH IP per showcased host', () => {
  const assets = loadAssets();
  const payload = buildPrivateInfrastructurePayload(assets);

  assert.equal(
    payload.links['svc-homepage-dashboard.links.app'],
    EXPECTED_ENDPOINTS['svc-homepage-dashboard'],
  );
  assert.equal(payload.links['svc-sub-store.links.admin'], EXPECTED_ENDPOINTS['svc-sub-store']);
  assert.ok(!('portal.home' in payload.links), 'Heuristic portal.home alias must not be emitted.');

  for (const assetId of SHOWCASE_HOSTS) {
    const asset = findAsset(assets, assetId);
    const protectedSshLinks = (asset.links ?? []).filter(
      link => link.kind === 'ssh' && (link.visibility === 'private' || link.visibility === 'internal'),
    );
    assert.equal(protectedSshLinks.length, 1, `${assetId} must define one protected SSH link.`);

    const hostname = new URL(protectedSshLinks[0].url).hostname;
    assert.equal(payload.values[`${assetId}.ip`], hostname);
  }
});
