import { getInfrastructureResources, type InfrastructureResource } from './infrastructure';
import { compareResourcePriority } from '../domain/resource-order';

/** Public-safe service targets are derived only from Personal Infrastructure. */
export interface InfrastructureService {
  resource: InfrastructureResource;
  host?: InfrastructureResource;
  url?: string;
  privateRef?: string;
  pinned: boolean;
  category: string;
}

export interface InfrastructureServiceSearchEntry {
  type: 'service';
  label: 'SVC';
  title: string;
  desc: string;
  href: string;
  aliases: string[];
  privateRef?: string;
  pinned: boolean;
}

const serviceGroup = ['portal-apps', 'portal-ai', 'portal-ops', 'portal-homelab'];
const linkOrder = ['editor', 'app', 'admin', 'monitor', 'panel', 'service'];

export function getInfrastructureServices(
  resources: InfrastructureResource[] = getInfrastructureResources(),
): InfrastructureService[] {
  const resourceMap = new Map(resources.map((resource) => [resource.id, resource]));
  return resources
    .filter(
      (resource) =>
        resource.kind === 'service' &&
        resource.status === 'active' &&
        (resource.homepage !== undefined ||
          resource.groups.some((group) => serviceGroup.includes(group))),
    )
    .map((resource) => {
      const ordered = [...(resource.links ?? [])].sort(
        (a, b) =>
          (linkOrder.indexOf(a.kind) < 0 ? Infinity : linkOrder.indexOf(a.kind)) -
          (linkOrder.indexOf(b.kind) < 0 ? Infinity : linkOrder.indexOf(b.kind)),
      );
      const link = ordered.find((item) => item.url || item.privateRef);
      return {
        resource,
        host: resource.hostResourceId ? resourceMap.get(resource.hostResourceId) : undefined,
        url: link?.url,
        privateRef: link?.privateRef,
        pinned: resource.homepage?.enabled === true && resource.homepage.featured === true,
        category: resource.groups.find((group) => serviceGroup.includes(group)) ?? 'service',
      };
    })
    .sort((a, b) => compareResourcePriority(a.resource, b.resource));
}

export function getInfrastructureServiceSearchIndex(): InfrastructureServiceSearchEntry[] {
  return getInfrastructureServices().map((service) => ({
    type: 'service',
    label: 'SVC',
    title: service.resource.title,
    desc: `${service.host?.title ?? 'Unassigned'} · ${service.privateRef ? 'Owner' : service.url ? 'Public' : 'Catalog'}`,
    // A private target is never embedded in a public JSON response.
    href: `/infrastructure/${service.resource.id}`,
    aliases: [
      service.resource.title.toLowerCase(),
      service.resource.titleEn?.toLowerCase() ?? '',
      service.resource.role?.toLowerCase() ?? '',
      service.host?.title.toLowerCase() ?? '',
      service.category,
    ].filter(Boolean),
    privateRef: service.privateRef,
    pinned: service.pinned,
  }));
}
