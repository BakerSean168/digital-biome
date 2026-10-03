export type PdsRepositoryRelation = 'canonical' | 'transitional' | 'archived' | 'external';

export interface PdsCatalogRepositoryRef {
  id: string;
  relation: PdsRepositoryRelation;
}

export interface PdsCatalogDomain {
  id: string;
  name: string;
  repositories: PdsCatalogRepositoryRef[];
  projections?: string[];
  owns?: string[];
  mustNotOwn?: string[];
  catalogOwnedComponents?: string[];
  principle?: string;
}

export interface PdsCatalogRepository {
  id: string;
  domainId: string;
  relation: PdsRepositoryRelation;
}

export interface PdsCatalogV1 {
  schemaVersion: 1;
  product: 'pds-catalog-v1';
  generated: true;
  editable: false;
  producer: 'pds://system/component/personal-digital-system';
  source: {
    repository: 'https://github.com/BakerSean168/personal-digital-system.git';
    revision: string;
  };
  payload: {
    domains: PdsCatalogDomain[];
    repositories: PdsCatalogRepository[];
    summary: {
      domainCount: number;
      repositoryCount: number;
      projectionCount: number;
    };
  };
}

const RELATIONS = new Set<PdsRepositoryRelation>([
  'canonical',
  'transitional',
  'archived',
  'external',
]);

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${label} must be a string array`);
  }
}

function optionalStringArray(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  assertStringArray(value, label);
  return value;
}

function parseRepositoryRef(value: unknown, label: string): PdsCatalogRepositoryRef {
  assertRecord(value, label);
  assertNonEmptyString(value.id, `${label}.id`);
  if (
    typeof value.relation !== 'string' ||
    !RELATIONS.has(value.relation as PdsRepositoryRelation)
  ) {
    throw new Error(`${label}.relation is invalid`);
  }
  return { id: value.id, relation: value.relation as PdsRepositoryRelation };
}

export function parsePdsCatalogV1(raw: string): PdsCatalogV1 {
  const value: unknown = JSON.parse(raw);
  assertRecord(value, 'pds-catalog-v1');
  if (
    value.schemaVersion !== 1 ||
    value.product !== 'pds-catalog-v1' ||
    value.generated !== true ||
    value.editable !== false ||
    value.producer !== 'pds://system/component/personal-digital-system'
  ) {
    throw new Error('pds-catalog-v1 envelope mismatch');
  }

  assertRecord(value.source, 'pds-catalog-v1.source');
  if (
    value.source.repository !== 'https://github.com/BakerSean168/personal-digital-system.git' ||
    typeof value.source.revision !== 'string' ||
    !/^[0-9a-f]{40}$/.test(value.source.revision)
  ) {
    throw new Error('pds-catalog-v1 source provenance is invalid');
  }

  assertRecord(value.payload, 'pds-catalog-v1.payload');
  if (!Array.isArray(value.payload.domains) || !Array.isArray(value.payload.repositories)) {
    throw new Error('pds-catalog-v1 payload collections are invalid');
  }
  assertRecord(value.payload.summary, 'pds-catalog-v1.payload.summary');

  const domainIds = new Set<string>();
  let projectionCount = 0;
  for (const [index, rawDomain] of value.payload.domains.entries()) {
    assertRecord(rawDomain, `domain[${index}]`);
    assertNonEmptyString(rawDomain.id, `domain[${index}].id`);
    assertNonEmptyString(rawDomain.name, `domain[${index}].name`);
    if (domainIds.has(rawDomain.id)) throw new Error(`duplicate domain id: ${rawDomain.id}`);
    domainIds.add(rawDomain.id);
    if (!Array.isArray(rawDomain.repositories)) {
      throw new Error(`${rawDomain.id}.repositories must be an array`);
    }
    rawDomain.repositories.forEach((repository, repositoryIndex) => {
      parseRepositoryRef(repository, `${rawDomain.id}.repositories[${repositoryIndex}]`);
    });
    const projections = optionalStringArray(rawDomain.projections, `${rawDomain.id}.projections`);
    optionalStringArray(rawDomain.owns, `${rawDomain.id}.owns`);
    optionalStringArray(rawDomain.mustNotOwn, `${rawDomain.id}.mustNotOwn`);
    optionalStringArray(rawDomain.catalogOwnedComponents, `${rawDomain.id}.catalogOwnedComponents`);
    if (rawDomain.principle !== undefined) {
      assertNonEmptyString(rawDomain.principle, `${rawDomain.id}.principle`);
    }
    projectionCount += projections?.length ?? 0;
  }

  const repositoryIds = new Set<string>();
  for (const [index, rawRepository] of value.payload.repositories.entries()) {
    assertRecord(rawRepository, `repository[${index}]`);
    assertNonEmptyString(rawRepository.id, `repository[${index}].id`);
    assertNonEmptyString(rawRepository.domainId, `repository[${index}].domainId`);
    if (!domainIds.has(rawRepository.domainId)) {
      throw new Error(`${rawRepository.id}.domainId references missing domain`);
    }
    if (
      typeof rawRepository.relation !== 'string' ||
      !RELATIONS.has(rawRepository.relation as PdsRepositoryRelation)
    ) {
      throw new Error(`${rawRepository.id}.relation is invalid`);
    }
    if (repositoryIds.has(rawRepository.id)) {
      throw new Error(`duplicate repository id: ${rawRepository.id}`);
    }
    repositoryIds.add(rawRepository.id);
  }

  const summary = value.payload.summary;
  if (
    summary.domainCount !== value.payload.domains.length ||
    summary.repositoryCount !== value.payload.repositories.length ||
    summary.projectionCount !== projectionCount
  ) {
    throw new Error('pds-catalog-v1 summary does not match payload contents');
  }

  return value as unknown as PdsCatalogV1;
}
