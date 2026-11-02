import infraProjectionData from '../data/infrastructure/infra-public-v2.json';
import type { TopologyNode } from '../data/infrastructure/family-topology';
import {
  parseInfraPublicV2,
  type InfraPublicV2,
  type InfrastructureConnection,
  type InfrastructureResource,
  type InfrastructureResourceLink,
} from '../domain/infrastructure/infra-public-v2';

export type {
  InfraPublicV2,
  InfrastructureConnection,
  InfrastructureResource,
  InfrastructureResourceLink,
};

export interface ResolvedInfrastructureResource extends InfrastructureResource {
  href: string;
}

// Compatibility types for presentation components that no longer own infrastructure facts.
export interface ResolvedTopologyNode extends TopologyNode {
  href?: string;
  primaryUrl?: string;
  monitorUrl?: string;
}

const projection = parseInfraPublicV2(JSON.stringify(infraProjectionData));

export function getInfrastructureResources(): InfrastructureResource[] {
  return [...projection.payload.resources];
}

export function getInfrastructureConnections(): InfrastructureConnection[] {
  return [...projection.payload.connections];
}

export function getInfrastructureDataset(localePrefix = ''): {
  projection: InfraPublicV2;
  resources: ResolvedInfrastructureResource[];
  resourceMap: Map<string, ResolvedInfrastructureResource>;
  connections: InfrastructureConnection[];
  fleetHosts: ResolvedInfrastructureResource[];
  homelabResources: ResolvedInfrastructureResource[];
} {
  const resources = projection.payload.resources.map((resource) => ({
    ...resource,
    href: `${localePrefix}/infrastructure/${resource.id}`,
  }));
  const resolvedMap = new Map(resources.map((resource) => [resource.id, resource]));

  return {
    projection,
    resources,
    resourceMap: resolvedMap,
    connections: projection.payload.connections,
    fleetHosts: resources.filter(
      (resource) =>
        resource.kind === 'host' &&
        resource.status === 'active' &&
        resource.groups.includes('public-fleet'),
    ),
    homelabResources: resources.filter((resource) => resource.groups.includes('homelab')),
  };
}
