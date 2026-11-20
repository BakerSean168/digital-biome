import assert from 'node:assert/strict';
import test from 'node:test';
import { getInfrastructureResources, type InfrastructureResource } from './infrastructure';
import {
  getInfrastructureServices,
  getInfrastructureServiceSearchIndex,
} from './infrastructure-services';

test('service index contains producer-owned active services and never retired endpoints', () => {
  const resources = getInfrastructureResources();
  const items = getInfrastructureServices();
  assert.ok(items.length > 0);
  assert.ok(
    items.every((item) => item.resource.kind === 'service' && item.resource.status === 'active'),
  );
  assert.ok(items.every((item) => resources.some((resource) => resource.id === item.resource.id)));
  assert.equal(
    items.some((item) => item.resource.id === 'svc-sing-box-japan'),
    false,
  );
  const index = getInfrastructureServiceSearchIndex();
  const litellm = index.find((item) => item.title === 'LiteLLM');
  assert.ok(litellm);
  assert.equal(litellm.href, '/infrastructure/svc-litellm-model-gateway');
  assert.doesNotMatch(JSON.stringify(index), /\.ts\.net|100\.68\.|100\.78\./);
});

test('private service launchers do not leak protected URLs into the public index', () => {
  const resources: InfrastructureResource[] = [
    {
      id: 'svc-private',
      title: 'Private',
      kind: 'service',
      status: 'active',
      description: '',
      groups: ['portal-apps'],
      links: [{ kind: 'admin', label: 'Admin', privateRef: 'svc-private.links.admin' }],
    },
  ];
  const [item] = getInfrastructureServices(resources);
  assert.equal(item?.privateRef, 'svc-private.links.admin');
  assert.equal(item?.url, undefined);
});

test('service selection honors lifecycle, producer priority, featured flags and link preference', () => {
  const service = (
    id: string,
    extra: Partial<InfrastructureResource> = {},
  ): InfrastructureResource => ({
    id,
    title: id,
    kind: 'service',
    status: 'active',
    description: '',
    groups: ['portal-apps'],
    ...extra,
  });
  const services = getInfrastructureServices([
    service('unranked'),
    service('private', {
      usagePriority: 2,
      homepage: { enabled: true, featured: true },
      links: [
        { kind: 'monitor', label: 'Public', url: 'https://example.test/monitor' },
        { kind: 'app', label: 'Owner', privateRef: 'private.links.app' },
      ],
    }),
    service('public', {
      usagePriority: 1,
      homepage: { enabled: false, featured: true },
      links: [{ kind: 'app', label: 'App', url: 'https://example.test/' }],
    }),
    ...(['planned', 'retired', 'archived', 'decommissioning'] as const).map((status) =>
      service(status, { status }),
    ),
    service('host', { kind: 'host' }),
    service('not-selected', { groups: [] }),
  ]);
  assert.deepEqual(
    services.map((item) => item.resource.id),
    ['public', 'private', 'unranked'],
  );
  assert.equal(services[0].url, 'https://example.test/');
  assert.equal(services[0].pinned, false);
  assert.equal(services[1].pinned, true);
  assert.equal(services[1].url, undefined);
  assert.equal(services[1].privateRef, 'private.links.app');
});

test('every anonymous service search target is an existing Infrastructure detail', () => {
  const ids = new Set(getInfrastructureResources().map((resource) => resource.id));
  for (const entry of getInfrastructureServiceSearchIndex()) {
    assert.ok(entry.href.startsWith('/infrastructure/'));
    assert.ok(ids.has(entry.href.slice('/infrastructure/'.length)));
  }
});
