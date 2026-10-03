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
  return getInfrastructureResources()
    .filter(
      (resource) =>
        resource.status === 'active' &&
        (resource.kind === 'service' || resource.kind === 'platform'),
    )
    .map((resource) => {
      const link = resource.links?.find((candidate) => candidate.url || candidate.privateRef);
      return {
        resource,
        access: link?.url ? 'public' : link?.privateRef ? 'owner' : 'catalog',
        url: link?.url,
        privateRef: link?.privateRef,
      } satisfies SystemQuickAccess;
    })
    .sort((a, b) => {
      const rank = { public: 0, owner: 1, catalog: 2 } as const;
      return rank[a.access] - rank[b.access] || a.resource.title.localeCompare(b.resource.title);
    });
}

function factCountsForDomains(domains: readonly PdsCatalogDomain[]) {
  const resources = getInfrastructureResources();
  return {
    domainCount: domains.length,
    repositoryCount: domains.reduce((count, domain) => count + domain.repositories.length, 0),
    projectionCount: domains.reduce(
      (count, domain) => count + (domain.projections?.length ?? 0),
      0,
    ),
    activeServiceCount: resources.filter(
      (resource) => resource.status === 'active' && resource.kind === 'service',
    ).length,
    activeHostCount: resources.filter(
      (resource) => resource.status === 'active' && resource.kind === 'host',
    ).length,
  };
}

export function publicSystemFactCounts() {
  return factCountsForDomains(publicSystemDomains(catalog.payload.domains));
}
