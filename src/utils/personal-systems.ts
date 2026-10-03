import catalogData from '../data/system/pds-catalog-v1.json';
import {
  parsePdsCatalogV1,
  type PdsCatalogDomain,
  type PdsCatalogRepository,
} from '../domain/system/pds-catalog-v1';
import { getInfrastructureResources, type InfrastructureResource } from './infrastructure';

const catalog = parsePdsCatalogV1(JSON.stringify(catalogData));

export interface SystemQuickAccess {
  resource: InfrastructureResource;
  access: 'public' | 'owner' | 'catalog';
  url?: string;
  privateRef?: string;
}

export function getPdsCatalog() {
  return catalog;
}

export function getSystemDomains(): PdsCatalogDomain[] {
  return [...catalog.payload.domains];
}

export function getSystemRepositories(): PdsCatalogRepository[] {
  return [...catalog.payload.repositories];
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

export function systemFactCounts() {
  const resources = getInfrastructureResources();
  return {
    domainCount: catalog.payload.summary.domainCount,
    repositoryCount: catalog.payload.summary.repositoryCount,
    projectionCount: catalog.payload.summary.projectionCount,
    activeServiceCount: resources.filter(
      (resource) => resource.status === 'active' && resource.kind === 'service',
    ).length,
    activeHostCount: resources.filter(
      (resource) => resource.status === 'active' && resource.kind === 'host',
    ).length,
  };
}
