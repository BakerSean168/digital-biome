import catalogData from '../data/system/pds-catalog-v1.json';
import { parsePdsCatalogV1, type PdsCatalogDomain } from '../domain/system/pds-catalog-v1';
import { publicSystemDomains } from '../config/personal-systems-access';
import { getInfrastructureResources, type InfrastructureResource } from './infrastructure';

const catalog = parsePdsCatalogV1(JSON.stringify(catalogData));

export interface SystemQuickAccess {
  resource: InfrastructureResource;
  access: 'public' | 'owner' | 'catalog';
  url?: string;
  privateRef?: string;
}

export function getPublicSystemDomains(): PdsCatalogDomain[] {
  return publicSystemDomains(catalog.payload.domains);
}

export function getSystemQuickAccess(): SystemQuickAccess[] {
  const preferredIds = [
    'svc-nezha-panel',
    'svc-memoflow-dailyuse',
    'svc-homepage-dashboard',
    'svc-pve-panel',
    'svc-sub-store',
  ] as const;
  const resources = new Map(
    getInfrastructureResources().map((resource) => [resource.id, resource]),
  );

  return preferredIds.flatMap((resourceId) => {
    const resource = resources.get(resourceId);
    if (resource?.status !== 'active') return [];
    const link = resource.links?.find((candidate) => candidate.url || candidate.privateRef);
    return [
      {
        resource,
        access: link?.url ? 'public' : link?.privateRef ? 'owner' : 'catalog',
        url: link?.url,
        privateRef: link?.privateRef,
      } satisfies SystemQuickAccess,
    ];
  });
}

function factCountsForDomains(domains: readonly PdsCatalogDomain[]) {
  const resources = getInfrastructureResources();
  return {
    domainCount: domains.length,
    cloudHostCount: resources.filter(
      (resource) =>
        resource.kind === 'host' &&
        resource.status === 'active' &&
        resource.groups.includes('public-fleet'),
    ).length,
  };
}

export function publicSystemFactCounts() {
  return factCountsForDomains(publicSystemDomains(catalog.payload.domains));
}
