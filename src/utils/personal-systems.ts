import catalogData from '../data/system/pds-catalog-v1.json';
import { parsePdsCatalogV1, type PdsCatalogDomain } from '../domain/system/pds-catalog-v1';
import { publicSystemDomains } from '../config/personal-systems-access';
import { getInfrastructureResources, type InfrastructureResource } from './infrastructure';

const catalog = parsePdsCatalogV1(JSON.stringify(catalogData));

export type PortalServiceCategory = 'apps' | 'ai' | 'ops' | 'homelab';

export interface PortalService {
  resource: InfrastructureResource;
  category: PortalServiceCategory;
  host?: InfrastructureResource;
  access: 'public' | 'owner' | 'catalog';
  url?: string;
  privateRef?: string;
  actionLabel: string;
  pinned: boolean;
}

export interface PortalServer {
  resource: InfrastructureResource;
  serviceCount: number;
}

export interface PortalServiceSearchEntry {
  type: 'service';
  label: 'SVC';
  title: string;
  desc: string;
  href: string;
  aliases: string[];
  privateRef?: string;
  pinned: boolean;
}

const CATEGORY_GROUPS: Record<PortalServiceCategory, string> = {
  apps: 'portal-apps',
  ai: 'portal-ai',
  ops: 'portal-ops',
  homelab: 'portal-homelab',
};

const LINK_KIND_PRIORITY = ['editor', 'app', 'admin', 'monitor', 'panel', 'service'] as const;

export function getPublicSystemDomains(): PdsCatalogDomain[] {
  return publicSystemDomains(catalog.payload.domains);
}

function serviceCategory(resource: InfrastructureResource): PortalServiceCategory | undefined {
  for (const category of Object.keys(CATEGORY_GROUPS) as PortalServiceCategory[]) {
    if (resource.groups.includes(CATEGORY_GROUPS[category])) return category;
  }
  return undefined;
}

function primaryLink(resource: InfrastructureResource) {
  for (const kind of LINK_KIND_PRIORITY) {
    const match = resource.links?.find((link) => link.kind === kind);
    if (match) return match;
  }
  return resource.links?.find((link) => link.url || link.privateRef);
}

function actionLabel(kind: string | undefined): string {
  if (!kind) return 'Detail';
  if (kind === 'editor') return 'Editor';
  if (kind === 'admin') return 'Admin';
  if (kind === 'monitor') return 'Monitor';
  return 'Open';
}

export function getPortalServices(): PortalService[] {
  const resources = getInfrastructureResources();
  const resourceMap = new Map(resources.map((resource) => [resource.id, resource]));

  return resources
    .filter((resource) => resource.kind === 'service' && resource.status === 'active')
    .flatMap((resource) => {
      const category = serviceCategory(resource);
      if (!category) return [];
      const link = primaryLink(resource);
      const access: PortalService['access'] = link?.url
        ? 'public'
        : link?.privateRef
          ? 'owner'
          : 'catalog';
      return [
        {
          resource,
          category,
          host: resource.hostResourceId ? resourceMap.get(resource.hostResourceId) : undefined,
          access,
          url: link?.url,
          privateRef: link?.privateRef,
          actionLabel: actionLabel(link?.kind),
          pinned: resource.groups.includes('portal-pinned'),
        } satisfies PortalService,
      ];
    })
    .sort((a, b) => a.resource.title.localeCompare(b.resource.title));
}

export function getPinnedPortalServices(): PortalService[] {
  return getPortalServices()
    .filter((service) => service.pinned)
    .slice(0, 8);
}

export function getPortalServers(): PortalServer[] {
  const resources = getInfrastructureResources();
  const services = getPortalServices();
  const order = [
    'host-gcp-iowa-c3d-development-vps',
    'host-aliyun-chengdu-dailyuse-vps',
    'host-oracle-osaka-amd-proxy-vps',
    'host-oracle-osaka-arm-development-vps',
  ];
  return resources
    .filter(
      (resource) =>
        resource.kind === 'host' &&
        resource.status === 'active' &&
        resource.groups.includes('public-fleet'),
    )
    .map((resource) => ({
      resource,
      serviceCount: services.filter((service) => service.resource.hostResourceId === resource.id)
        .length,
    }))
    .sort((a, b) => order.indexOf(a.resource.id) - order.indexOf(b.resource.id));
}

export function publicSystemFactCounts() {
  return {
    domainCount: getPublicSystemDomains().length,
    cloudHostCount: getPortalServers().length,
    serviceCount: getPortalServices().length,
  };
}

export function getPortalServiceSearchIndex(): PortalServiceSearchEntry[] {
  return getPortalServices().map((service) => {
    const host = service.host?.title ?? 'Unassigned';
    const href = service.url ?? `/systems#service-${service.resource.id}`;
    return {
      type: 'service',
      label: 'SVC',
      title: service.resource.title,
      desc: `${host} · ${service.access === 'owner' ? 'Owner' : service.access === 'public' ? 'Public' : 'Catalog'}`,
      href,
      privateRef: service.privateRef,
      pinned: service.pinned,
      aliases: [
        service.resource.title.toLowerCase(),
        service.resource.titleEn?.toLowerCase() ?? '',
        service.resource.role?.toLowerCase() ?? '',
        service.host?.title.toLowerCase() ?? '',
        service.category,
      ].filter(Boolean),
    };
  });
}
