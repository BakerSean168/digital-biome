import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPrivateInfrastructurePayload } from './export-private-infrastructure-legacy';

const requiredHosts = [
  'host-azure-hk-vps',
  'host-aliyun-chengdu-dailyuse-vps',
  'host-azure-japan-singbox-vps',
  'host-azure-korea-singbox-vps',
  'host-oracle-osaka-amd-proxy-vps',
  'host-oracle-osaka-arm-development-vps',
];

test('legacy rollback exporter preserves the historical v1/v2 payload contract', () => {
  const assets = requiredHosts.map((assetId, index) => ({
    assetId,
    links: [
      {
        label: 'SSH',
        url: `ssh://root@203.0.113.${index + 10}:22`,
        kind: 'ssh',
        visibility: 'private' as const,
      },
    ],
  }));
  assets.push({
    assetId: 'svc-example',
    links: [
      {
        label: 'Admin',
        url: 'https://private.example.test/',
        kind: 'admin',
        visibility: 'private' as const,
      },
    ],
  });

  const payload = buildPrivateInfrastructurePayload(assets);
  assert.equal(payload.version, 1);
  assert.equal(payload.values['host-azure-hk-vps.ip'], '203.0.113.10');
  assert.equal(payload.values['host-oracle-osaka-arm-development-vps.ip'], '203.0.113.15');
  assert.equal(payload.links['svc-example.links.admin'], 'https://private.example.test/');
});

test('legacy rollback exporter still fails closed when a required historical host is absent', () => {
  assert.throws(
    () =>
      buildPrivateInfrastructurePayload([
        {
          assetId: 'host-azure-hk-vps',
          links: [],
        },
      ]),
    /must define exactly one protected SSH IPv4 link/,
  );
});
