import type {
  InfrastructureConnection,
  InfrastructureResource,
  InfrastructureResourceLink,
} from '../domain/infrastructure/infra-public-v2';
import { infrastructureKindLabel } from './infrastructure-labels';

/**
 * Core home topology is required. Monitoring services are optional:
 * decommissioning Nezha must not break the entire infrastructure page.
 */
export const SHOWCASE_ANCHORS = {
  control: 'svc-homepage-dashboard',
  homePath: ['net-home-optical-modem', 'net-home-switch', 'net-home-ap', 'host-n100-pve'],
  homeHypervisor: 'host-n100-pve',
} as const;

const KIND_ORDER: InfrastructureResource['kind'][] = ['host', 'service', 'network', 'platform'];

export function publicLink(
  resource: InfrastructureResource,
  kinds: readonly string[],
): InfrastructureResourceLink | undefined {
  return resource.links?.find((link) => link.url && kinds.includes(link.kind));
}

export function privateLink(
  resource: InfrastructureResource,
  kinds: readonly string[],
): InfrastructureResourceLink | undefined {
  return resource.links?.find((link) => link.privateRef && kinds.includes(link.kind));
}

export function buildInfrastructureShowcase<R extends InfrastructureResource>(
  resources: readonly R[],
  connections: readonly InfrastructureConnection[],
) {
  const resourceMap = new Map(resources.map((resource) => [resource.id, resource]));
  const anchor = (id: string): R => {
    const resource = resourceMap.get(id);
    if (!resource) {
      throw new Error(
        `InfrastructureShowcase: anchor resource "${id}" is missing from infra-public-v2`,
      );
    }
    return resource;
  };

  const homelabResources = resources.filter((resource) => resource.groups.includes('homelab'));
  const homelabIds = new Set(homelabResources.map((resource) => resource.id));
  const homeHypervisor = anchor(SHOWCASE_ANCHORS.homeHypervisor);
  const monitorLink = resources
    .filter((resource) => resource.kind === 'service' && resource.status === 'active')
    .flatMap((resource) => resource.links ?? [])
    .find((link) => link.kind === 'monitor' && Boolean(link.url));

  return {
    resourceMap,
    activeResources: resources.filter((resource) => resource.status === 'active'),
    fleetHosts: resources.filter(
      (resource) =>
        resource.kind === 'host' &&
        resource.status === 'active' &&
        resource.groups.includes('public-fleet'),
    ),
    homelabResources,
    homeConnections: connections.filter(
      (connection) => homelabIds.has(connection.from) && homelabIds.has(connection.to),
    ),
    monitorLink,
    controlLink: privateLink(anchor(SHOWCASE_ANCHORS.control), ['app', 'admin']),
    homeNodes: SHOWCASE_ANCHORS.homePath.map(anchor),
    vmNodes: resources.filter((resource) => resource.parentResourceId === homeHypervisor.id),
    resourcesByKind: KIND_ORDER.map((kind) => ({
      kind,
      label: infrastructureKindLabel(kind),
      items: resources.filter((resource) => resource.kind === kind),
    })),
    hostedServices: (hostId: string) =>
      resources.filter(
        (resource) => resource.kind === 'service' && resource.hostResourceId === hostId,
      ),
  };
}
