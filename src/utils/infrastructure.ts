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

export interface HomelabLayer {
  id: string;
  level: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  nodeIds: string[];
  accentClass: string;
  spotlight: string;
  spotlightEn: string;
}

export interface FleetRegionCard {
  id: string;
  region: string;
  regionEn: string;
  provider: string;
  providerEn: string;
  role: string;
  roleEn: string;
  description: string;
  descriptionEn: string;
  hostNodeIds: string[];
  serviceNodeIds: string[];
  accentClass: string;
  providerClass: string;
  roleClass: string;
}

const projection = parseInfraPublicV2(JSON.stringify(infraProjectionData));
const resourceMap = new Map(
  projection.payload.resources.map((resource) => [resource.id, resource]),
);

export function getInfrastructureProjection(): InfraPublicV2 {
  return projection;
}

export function getInfrastructureResource(resourceId: string): InfrastructureResource | undefined {
  return resourceMap.get(resourceId);
}

export function getInfrastructureResources(): InfrastructureResource[] {
  return [...projection.payload.resources];
}

export function getInfrastructureConnections(): InfrastructureConnection[] {
  return [...projection.payload.connections];
}

export function getResourcesByGroup(group: string): InfrastructureResource[] {
  return projection.payload.resources.filter((resource) => resource.groups.includes(group));
}

export function getHostedServices(hostResourceId: string): InfrastructureResource[] {
  return projection.payload.resources.filter(
    (resource) => resource.hostResourceId === hostResourceId && resource.kind === 'service',
  );
}

export function getChildResources(parentResourceId: string): InfrastructureResource[] {
  return projection.payload.resources.filter(
    (resource) =>
      resource.parentResourceId === parentResourceId ||
      resource.hostResourceId === parentResourceId,
  );
}

export function getPublicLink(
  resource: InfrastructureResource | undefined,
  kinds: readonly string[],
): string | undefined {
  return resource?.links?.find((link) => link.url && kinds.includes(link.kind))?.url;
}

export function getPrivateLinkRef(
  resource: InfrastructureResource | undefined,
  kinds: readonly string[],
): string | undefined {
  return resource?.links?.find((link) => link.privateRef && kinds.includes(link.kind))?.privateRef;
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

export function infrastructureFactCounts(): {
  resourceCount: number;
  activeResourceCount: number;
  fleetHostCount: number;
  homelabResourceCount: number;
  connectionCount: number;
} {
  const resources = projection.payload.resources;
  return {
    resourceCount: resources.length,
    activeResourceCount: resources.filter((resource) => resource.status === 'active').length,
    fleetHostCount: resources.filter(
      (resource) =>
        resource.kind === 'host' &&
        resource.status === 'active' &&
        resource.groups.includes('public-fleet'),
    ).length,
    homelabResourceCount: resources.filter((resource) => resource.groups.includes('homelab'))
      .length,
    connectionCount: projection.payload.connections.length,
  };
}
