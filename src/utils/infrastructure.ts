import infraProjectionData from '../data/infrastructure/infra-public-v2.json';
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

/** Display-only node for the active asset sub-topology component. */
export interface ResolvedTopologyNode {
  id: string;
  title: string;
  kind: 'external' | 'network' | 'host' | 'hypervisor' | 'vm' | 'service' | 'tool';
  description: string;
  assetId?: string;
  status?: 'active' | 'planned' | 'internal';
  chips?: string[];
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
