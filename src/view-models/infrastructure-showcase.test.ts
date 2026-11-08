import assert from 'node:assert/strict';
import test from 'node:test';
import type { InfrastructureResource } from '../domain/infrastructure/infra-public-v2';
import { buildInfrastructureShowcase } from './infrastructure-showcase';

const item = (
  id: string,
  kind: InfrastructureResource['kind'] = 'network',
  extra: Partial<InfrastructureResource> = {},
): InfrastructureResource => ({
  id,
  title: id,
  description: '',
  kind,
  status: 'active',
  groups: ['homelab'],
  ...extra,
});

const core: InfrastructureResource[] = [
  item('net-home-optical-modem'),
  item('net-home-switch'),
  item('net-home-ap'),
  item('host-n100-pve', 'host'),
  item('svc-homepage-dashboard', 'service', {
    links: [{ label: 'Control', kind: 'admin', privateRef: 'svc-homepage-dashboard.links.app' }],
  }),
];

test('an absent retired monitoring service must not block live home topology', () => {
  const showcase = buildInfrastructureShowcase(core, []);
  assert.equal(showcase.monitorLink, undefined);
  assert.equal(showcase.homeNodes.length, 4);
  assert.equal(showcase.controlLink?.privateRef, 'svc-homepage-dashboard.links.app');
});

test('only active verified monitor links are eligible', () => {
  const historical = item('svc-retired-monitor', 'service', {
    status: 'retired',
    links: [{ label: 'Obsolete', kind: 'monitor', url: 'https://retired.invalid' }],
  });
  const active = item('svc-present-monitor', 'service', {
    links: [{ label: 'Monitor', kind: 'monitor', url: 'https://monitor.example.com' }],
  });
  assert.equal(buildInfrastructureShowcase([...core, historical], []).monitorLink, undefined);
  assert.equal(
    buildInfrastructureShowcase([...core, historical, active], []).monitorLink?.url,
    'https://monitor.example.com',
  );
});

test('mandatory home infrastructure remains fail-closed', () => {
  assert.throws(
    () =>
      buildInfrastructureShowcase(
        core.filter((resource) => resource.id !== 'host-n100-pve'),
        [],
      ),
    /anchor resource "host-n100-pve" is missing/,
  );
});
