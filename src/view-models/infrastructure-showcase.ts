import type {
  InfrastructureConnection,
  InfrastructureResource,
  InfrastructureResourceLink,
} from '../domain/infrastructure/infra-public-v2';
import { infrastructureKindLabel } from './infrastructure-labels';

/**
 * Resources the /infrastructure showcase is anchored on. They come from the
 * producer-owned infra-public-v2 product; if one is renamed or removed upstream
 * the build fails instead of silently rendering an empty section.
 */
export const SHOWCASE_ANCHORS = {
  monitor: 'svc-nezha-panel',
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
    monitorLink: publicLink(anchor(SHOWCASE_ANCHORS.monitor), ['monitor', 'admin', 'app']),
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
