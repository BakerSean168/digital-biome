import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildPrivateInfrastructurePayload } from './export-private-infrastructure';

interface AssetLink {
  label: string;
  url?: string;
  privateRef?: string;
  kind?: string;
  visibility?: 'public' | 'private' | 'internal';
}

interface AssetItem {
  assetId: string;
  links?: AssetLink[];
  monitor?: { url?: string };
}

const PRIVATE_ENDPOINTS = {
  'svc-homepage-dashboard': 'https://homepage.bakersean.top/',
  'svc-nezha-panel': 'https://nezha.bakersean.top/',
  'svc-sub-store': 'https://admin.bakersean.top/',
} as const;

const PUBLIC_ENDPOINTS = {
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

function privateFixture(): AssetItem[] {
  const host = (assetId: string, ip: string): AssetItem => ({
    assetId,
    links: [
      {
        label: 'SSH',
        kind: 'ssh',
        visibility: 'private',
        url: `ssh://root@${ip}:22`,
      },
    ],
  });

  return [
    {
      assetId: 'svc-homepage-dashboard',
      links: [
        {
          label: 'App',
          kind: 'app',
          visibility: 'private',
          url: PRIVATE_ENDPOINTS['svc-homepage-dashboard'],
        },
      ],
    },
    {
      assetId: 'svc-sub-store',
      links: [
        {
          label: 'Admin',
          kind: 'admin',
          visibility: 'private',
          url: PRIVATE_ENDPOINTS['svc-sub-store'],
        },
      ],
    },
    {
      assetId: 'host-gcp-iowa-c3d-development-vps',
      links: [
        {
          label: 'SSH',
          kind: 'ssh',
          visibility: 'private',
          url: 'ssh://dev@gcp-dev-01.taile92a8e.ts.net:22',
        },
      ],
    },
    ...SHOWCASE_HOSTS.map((assetId, index) => host(assetId, `203.0.113.${index + 10}`)),
  ];
}

test('producer-owned public projection hides protected infrastructure endpoints', (t) => {
  const generatedRoot = path.resolve(
    process.cwd(),
    '.pds-runtime/knowledge-public-v1/source/generated',
  );
  if (!fs.existsSync(generatedRoot)) {
    t.skip('knowledge-public-v1 runtime source is not materialized in this execution');
    return;
  }

  const assets = loadAssetIndex(generatedRoot);
  const serialized = JSON.stringify(assets);

  for (const hostname of FORBIDDEN_HOSTNAMES) {
    assert.ok(
      !serialized.includes(hostname),
      `Forbidden legacy hostname remains in public asset index: ${hostname}`,
    );
  }
  for (const endpoint of Object.values(PRIVATE_ENDPOINTS)) {
    assert.ok(
      !serialized.includes(endpoint),
      `Protected endpoint leaked into public asset index: ${endpoint}`,
    );
  }
  for (const [assetId, expectedUrl] of Object.entries(PUBLIC_ENDPOINTS)) {
    assert.ok(
      urlsFor(findAsset(assets, assetId)).has(expectedUrl),
      `${assetId} must preserve public endpoint ${expectedUrl}`,
    );
  }
});

test('private payload exporter preserves stable refs and explicit SSH IP rules', () => {
  const payload = buildPrivateInfrastructurePayload(
    privateFixture() as Parameters<typeof buildPrivateInfrastructurePayload>[0],
  );

  assert.equal(
    payload.links['svc-homepage-dashboard.links.app'],
    PRIVATE_ENDPOINTS['svc-homepage-dashboard'],
  );
  assert.equal(payload.links['svc-sub-store.links.admin'], PRIVATE_ENDPOINTS['svc-sub-store']);
  assert.equal(
    payload.links['host-gcp-iowa-c3d-development-vps.links.ssh'],
    'ssh://dev@gcp-dev-01.taile92a8e.ts.net:22',
  );
  assert.ok(!('host-gcp-iowa-c3d-development-vps.ip' in payload.values));

  SHOWCASE_HOSTS.forEach((assetId, index) => {
    assert.equal(payload.values[`${assetId}.ip`], `203.0.113.${index + 10}`);
  });
});

test('private Vault source still satisfies operational endpoint and SSH contracts when present', (t) => {
  const generatedRoot = path.resolve(process.cwd(), 'thought-forest/generated');
  if (!fs.existsSync(generatedRoot)) {
    t.skip(
      'private Thought Forest source is intentionally absent from this public-projection build',
    );
    return;
  }

  const assets = loadAssetIndex(generatedRoot);
  const serialized = JSON.stringify(assets);

  for (const hostname of FORBIDDEN_HOSTNAMES) {
    assert.ok(
      !serialized.includes(hostname),
      `Forbidden legacy hostname remains in private asset index: ${hostname}`,
    );
  }

  for (const [assetId, expectedUrl] of Object.entries({
    ...PRIVATE_ENDPOINTS,
    ...PUBLIC_ENDPOINTS,
  })) {
    assert.ok(
      urlsFor(findAsset(assets, assetId)).has(expectedUrl),
      `${assetId} must contain ${expectedUrl}`,
    );
  }

  const payload = buildPrivateInfrastructurePayload(
    assets as Parameters<typeof buildPrivateInfrastructurePayload>[0],
  );
  assert.equal(
    payload.links['svc-homepage-dashboard.links.app'],
    PRIVATE_ENDPOINTS['svc-homepage-dashboard'],
  );
  assert.equal(payload.links['svc-sub-store.links.admin'], PRIVATE_ENDPOINTS['svc-sub-store']);

  for (const assetId of SHOWCASE_HOSTS) {
    const asset = findAsset(assets, assetId);
    const protectedSshLinks = (asset.links ?? []).filter(
      (link) =>
        link.kind === 'ssh' &&
        Boolean(link.url) &&
        (link.visibility === 'private' || link.visibility === 'internal'),
    );
    assert.equal(protectedSshLinks.length, 1, `${assetId} must define one protected SSH link.`);

    const hostname = new URL(protectedSshLinks[0].url!).hostname;
    assert.equal(payload.values[`${assetId}.ip`], hostname);
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
