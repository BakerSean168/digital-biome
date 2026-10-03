import type { AccessContextData } from '../../../edge/access';
import catalogData from '../../../src/data/system/pds-catalog-v1.json';
import {
  ownerSystemDomains,
  visibleSystemDomains,
} from '../../../src/config/personal-systems-access';
import { parsePdsCatalogV1 } from '../../../src/domain/system/pds-catalog-v1';

const JSON_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

const catalog = parsePdsCatalogV1(JSON.stringify(catalogData));

function ownerCatalogFacts() {
  const domains = visibleSystemDomains(catalog.payload.domains);
  return {
    domainCount: domains.length,
    repositoryCount: domains.reduce((count, domain) => count + domain.repositories.length, 0),
    projectionCount: domains.reduce(
      (count, domain) => count + (domain.projections?.length ?? 0),
      0,
    ),
  };
}

export const onRequestGet: PagesFunction<Env, string, AccessContextData> = () =>
  Response.json(
    {
      version: 1,
      access: 'owner',
      domains: ownerSystemDomains(catalog.payload.domains),
      facts: ownerCatalogFacts(),
    },
    { headers: JSON_HEADERS },
  );
