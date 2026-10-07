import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPinnedPortalServices,
  getPortalServers,
  getPortalServices,
  getPortalServiceSearchIndex,
  publicSystemFactCounts,
} from './personal-systems';

test('Personal Systems exposes the current four-server cloud fleet', () => {
  const servers = getPortalServers();
  assert.deepEqual(
    servers.map((item) => item.resource.id),
    [
      'host-gcp-iowa-c3d-development-vps',
      'host-aliyun-chengdu-dailyuse-vps',
      'host-oracle-osaka-amd-proxy-vps',
      'host-oracle-osaka-arm-development-vps',
    ],
  );
});

test('Personal Systems launcher is producer-owned and includes important services', () => {
  const services = getPortalServices();
  const byId = new Map(services.map((item) => [item.resource.id, item]));
  for (const id of [
    'svc-personal-twin-editor',
    'svc-litellm-model-gateway',
    'svc-hermes-agent',
    'svc-nezha-panel',
    'svc-memoflow-dailyuse',
    'svc-job-harness',
    'svc-infrahub-home',
  ]) {
    assert.ok(byId.has(id), `${id} should be visible in the launcher`);
  }
  assert.equal(byId.get('svc-personal-twin-editor')?.category, 'apps');
  assert.equal(byId.get('svc-litellm-model-gateway')?.category, 'ai');
  assert.equal(byId.get('svc-litellm-model-gateway')?.access, 'owner');
  assert.equal(byId.get('svc-nezha-panel')?.access, 'public');
  assert.equal(byId.has('svc-sing-box-japan'), false);
});

test('Pinned launcher stays small while preserving representative services', () => {
  const pinned = getPinnedPortalServices();
  assert.ok(pinned.length <= 8);
  const ids = new Set(pinned.map((item) => item.resource.id));
  for (const id of ['svc-litellm-model-gateway', 'svc-hermes-agent', 'svc-nezha-panel']) {
    assert.ok(ids.has(id), `${id} should remain pinned`);
  }
});

test('global Search can discover launcher services without exposing private targets', () => {
  const index = getPortalServiceSearchIndex();
  const litellm = index.find((item) => item.title === 'LiteLLM');
  const twin = index.find((item) => item.title === 'Personal Twin');
  assert.ok(litellm);
  assert.ok(twin);
  assert.equal(litellm.href, '/systems#service-svc-litellm-model-gateway');
  assert.equal(litellm.privateRef, 'svc-litellm-model-gateway.links.admin');
  assert.equal(twin.href, '/systems#service-svc-personal-twin-editor');
  assert.doesNotMatch(JSON.stringify(index), /\.ts\.net|100\.68\.|100\.78\./);
});

test('Personal Systems facts count launcher services, not every infrastructure resource', () => {
  const facts = publicSystemFactCounts();
  assert.equal(facts.cloudHostCount, 4);
  assert.equal(facts.serviceCount, getPortalServices().length);
  assert.ok(facts.domainCount > 0);
});

import type { InfrastructureResource } from './infrastructure';

const resource = (
  id: string,
  extra: Partial<InfrastructureResource> = {},
): InfrastructureResource => ({
  id,
  title: id,
  kind: 'service',
  status: 'active',
  description: '',
  groups: ['portal-apps', 'portal-pinned'],
  ...extra,
});

test('homepage selection is explicit, ordered and independent of usage priority', () => {
  const resources = [
    resource('svc-later', {
      homepage: { enabled: true, featured: true, order: 20 },
      usagePriority: 1,
    }),
    resource('svc-first', { homepage: { enabled: true, featured: true, order: 0 } }),
    resource('svc-excluded', { homepage: { enabled: false, featured: true }, usagePriority: 1 }),
    resource('svc-legacy'),
    resource('svc-retired', { status: 'retired', homepage: { enabled: true, featured: true } }),
    resource('host-other', { kind: 'host', homepage: { enabled: true, featured: true } }),
  ];
  assert.deepEqual(
    getPinnedPortalServices(resources).map((item) => item.resource.id),
    ['svc-first', 'svc-later'],
  );
  assert.ok(getPortalServices(resources).some((item) => item.resource.id === 'svc-excluded'));
  assert.deepEqual(getPinnedPortalServices([resource('svc-none', { homepage: {} })]), []);
  assert.deepEqual(getPinnedPortalServices([resources[4], resource('svc-legacy')]), []);
  assert.deepEqual(getPinnedPortalServices([]), []);
  assert.equal(getPinnedPortalServices([resource('svc-legacy')]).length, 1);
});
