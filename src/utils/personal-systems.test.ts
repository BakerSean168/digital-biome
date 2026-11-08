import assert from 'node:assert/strict';
import test from 'node:test';
import { getInfrastructureResources, type InfrastructureResource } from './infrastructure';
import {
  getPinnedPortalServices,
  getPortalServers,
  getPortalServices,
  getPortalServiceSearchIndex,
  publicSystemFactCounts,
} from './personal-systems';

test('Personal Systems includes only active cloud hosts, regardless of former identities', () => {
  const resources = getInfrastructureResources();
  const servers = getPortalServers();
  assert.deepEqual(
    new Set(servers.map((item) => item.resource.id)),
    new Set(
      resources
        .filter(
          (item) =>
            item.kind === 'host' &&
            item.status === 'active' &&
            item.groups.includes('public-fleet'),
        )
        .map((item) => item.id),
    ),
  );
  assert.ok(servers.every((item) => item.resource.status === 'active'));
});

test('Personal Systems launcher includes producer-owned active services only', () => {
  const services = getPortalServices();
  const byId = new Map(services.map((item) => [item.resource.id, item]));
  for (const id of ['svc-litellm-model-gateway', 'svc-memoflow-dailyuse', 'svc-job-harness']) {
    assert.ok(byId.has(id), `${id} should remain in the active launcher`);
  }
  assert.equal(byId.get('svc-litellm-model-gateway')?.category, 'ai');
  assert.equal(
    byId.get('svc-litellm-model-gateway')?.access,
    byId.get('svc-litellm-model-gateway')?.resource.links?.some((link) => link.privateRef)
      ? 'owner'
      : 'catalog',
  );

  const currentResources = new Map(getInfrastructureResources().map((item) => [item.id, item]));
  for (const id of [
    'svc-hermes-agent',
    'svc-nezha-panel',
    'svc-infrahub-home',
    'svc-forgeflow-control-plane',
    'svc-personal-twin-editor',
  ]) {
    if (currentResources.get(id)?.status !== 'active') {
      assert.equal(byId.has(id), false, `${id} must not be shown after decommission`);
    }
  }
  assert.equal(byId.has('svc-sing-box-japan'), false);
});

test('Pinned launcher is a small producer-selected set of active services', () => {
  const pinned = getPinnedPortalServices();
  assert.ok(pinned.length <= 8);
  assert.ok(pinned.every((item) => item.resource.status === 'active'));
  const ids = new Set(pinned.map((item) => item.resource.id));
  for (const id of ['svc-memoflow-dailyuse', 'svc-homepage-dashboard']) {
    assert.ok(ids.has(id), `${id} should remain a featured service`);
  }
});

test('global Search follows available active resources and does not leak private targets', () => {
  const index = getPortalServiceSearchIndex();
  const services = getPortalServices();
  assert.deepEqual(
    new Set(index.map((item) => item.title)),
    new Set(services.map((item) => item.resource.title)),
  );
  const litellm = index.find((item) => item.title === 'LiteLLM');
  assert.ok(litellm);
  assert.equal(litellm.href, '/systems#service-svc-litellm-model-gateway');
  assert.equal(
    litellm.privateRef,
    services.find((item) => item.resource.id === 'svc-litellm-model-gateway')?.privateRef,
  );
  assert.doesNotMatch(JSON.stringify(index), /\\.ts\\.net|100\\.68\\.|100\\.78\\./);
});

test('Personal Systems fact counts reflect live resources instead of fixed legacy totals', () => {
  const facts = publicSystemFactCounts();
  assert.equal(facts.cloudHostCount, getPortalServers().length);
  assert.equal(facts.serviceCount, getPortalServices().length);
  assert.ok(facts.domainCount > 0);
});

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

test('decommissioned Oracle2 / GCP and inactive services do not appear in live projections', () => {
  const resources = [
    resource('host-retired-oracle2', {
      kind: 'host',
      status: 'retired',
      groups: ['public-fleet'],
    }),
    resource('host-legacy-gcp', {
      kind: 'host',
      status: 'archived',
      groups: ['public-fleet'],
    }),
    resource('host-active-n100', {
      kind: 'host',
      status: 'active',
      groups: ['public-fleet'],
    }),
    resource('svc-retired-hermes', {
      status: 'retired',
      groups: ['portal-ai'],
      homepage: { enabled: true, featured: true, order: 0 },
    }),
    resource('svc-active', {
      status: 'active',
      groups: ['portal-ai'],
      homepage: { enabled: true, featured: true, order: 10 },
    }),
  ];
  assert.deepEqual(
    getPortalServers(resources).map((item) => item.resource.id),
    ['host-active-n100'],
  );
  assert.deepEqual(
    getPortalServices(resources).map((item) => item.resource.id),
    ['svc-active'],
  );
  assert.deepEqual(
    getPinnedPortalServices(resources).map((item) => item.resource.id),
    ['svc-active'],
  );
});

test('homepage selection is explicit, ordered and independent of usage priority', () => {
  const resources = [
    resource('svc-later', {
      homepage: { enabled: true, featured: true, order: 20 },
      usagePriority: 1,
    }),
    resource('svc-first', {
      homepage: { enabled: true, featured: true, order: 0 },
    }),
    resource('svc-excluded', {
      homepage: { enabled: false, featured: true },
      usagePriority: 1,
    }),
    resource('svc-legacy'),
    resource('svc-retired', {
      status: 'retired',
      homepage: { enabled: true, featured: true },
    }),
    resource('host-other', {
      kind: 'host',
      homepage: { enabled: true, featured: true },
    }),
  ];
  assert.deepEqual(
    getPinnedPortalServices(resources).map((item) => item.resource.id),
    ['svc-first', 'svc-later'],
  );
  assert.ok(getPortalServices(resources).some((item) => item.resource.id === 'svc-excluded'));
  assert.deepEqual(getPinnedPortalServices([resource('svc-none', { homepage: {} })]), []);
  assert.deepEqual(getPinnedPortalServices([resources[4], resource('svc-legacy')]), []);
  assert.deepEqual(getPinnedPortalServices([]), []);
  assert.deepEqual(getPinnedPortalServices([resource('svc-legacy')]), []);
});
