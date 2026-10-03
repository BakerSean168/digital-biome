import type { PdsCatalogDomain } from '../domain/system/pds-catalog-v1';

export type PersonalSystemAccessTier = 'public' | 'owner' | 'hidden';

/**
 * Presentation policy belongs to Digital Biome, not the PDS catalog producer.
 *
 * PDS answers "what exists / who owns it". This policy answers "who may see it
 * on this site". Unknown domains fail closed to `owner` so newly catalogued
 * internal systems never become public by accident.
 */
export const PERSONAL_SYSTEMS_ACCESS: Readonly<Record<string, PersonalSystemAccessTier>> = {
  infrastructure: 'public',
  knowledge: 'public',
  presentation: 'public',
  products: 'owner',
  'personal-config': 'owner',
  'personal-twin': 'owner',
  'agent-platform': 'owner',
};

export function personalSystemAccessTier(domainId: string): PersonalSystemAccessTier {
  return PERSONAL_SYSTEMS_ACCESS[domainId] ?? 'owner';
}

export function publicSystemDomains(domains: readonly PdsCatalogDomain[]): PdsCatalogDomain[] {
  return domains.filter((domain) => personalSystemAccessTier(domain.id) === 'public');
}

export function ownerSystemDomains(domains: readonly PdsCatalogDomain[]): PdsCatalogDomain[] {
  return domains.filter((domain) => personalSystemAccessTier(domain.id) === 'owner');
}

export function visibleSystemDomains(domains: readonly PdsCatalogDomain[]): PdsCatalogDomain[] {
  return domains.filter((domain) => personalSystemAccessTier(domain.id) !== 'hidden');
}
