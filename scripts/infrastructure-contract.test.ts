import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseInfraPublicV2 } from '../src/domain/infrastructure/infra-public-v2';

function loadProjection(t: { skip(message?: string): void }) {
  const file = path.resolve('src/data/infrastructure/infra-public-v2.json');
  if (!fs.existsSync(file)) {
    t.skip('infra-public-v2 is not materialized in this execution');
    return null;
  }
  return parseInfraPublicV2(fs.readFileSync(file, 'utf8'));
}

test('Personal Infrastructure projection is authoritative for infrastructure presentation', (t) => {
  const projection = loadProjection(t);
  if (!projection) return;

  const resources = projection.payload.resources;
  const ids = new Set(resources.map((resource) => resource.id));
  for (const required of [
    'host-oracle-osaka-arm-development-vps',
    'host-aliyun-chengdu-dailyuse-vps',
    'host-n100-pve',
    'net-home-lan',
    'svc-homepage-dashboard',
    'svc-nezha-panel',
  ]) {
    assert.ok(ids.has(required), `infra-public-v2 is missing ${required}`);
  }

  const memoflow = resources.find((resource) => resource.id === 'svc-memoflow-dailyuse');
  assert.ok(
    memoflow?.links?.some((link) => link.url === 'https://memoflow.bakersean.top/'),
    'MemoFlow public endpoint must come from Personal Infrastructure projection',
  );

  let privateRefs = 0;
  for (const resource of resources) {
    for (const link of resource.links ?? []) {
      if (link.privateRef) {
        privateRefs += 1;
        assert.equal(link.url, undefined, `${resource.id} leaked a protected link URL`);
      }
    }
  }
  assert.ok(privateRefs > 0, 'expected stable privateRef identities in infra-public-v2');
});

test('Digital Biome no longer owns infrastructure fact tables', () => {
  const showcase = fs.readFileSync(
    path.resolve('src/components/assets/InfrastructureShowcase.astro'),
    'utf8',
  );
  const legacyTopology = fs.readFileSync(
    path.resolve('src/data/infrastructure/family-topology.ts'),
    'utf8',
  );

  assert.doesNotMatch(showcase, /const\s+vpsNodes\s*[:=]/);
  assert.match(showcase, /Personal Infrastructure → infra-public-v2/);
  assert.match(legacyTopology, /familyTopology:\s*TopologyFlow\[\]\s*=\s*\[\]/);
  assert.doesNotMatch(legacyTopology, /Azure Japan|Aliyun Chengdu|N100 PVE 主机/);
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
