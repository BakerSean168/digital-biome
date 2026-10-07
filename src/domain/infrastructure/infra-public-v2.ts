import type { HomepageConfig } from '../../types/notes';
import { parseUsagePriority } from '../resource-order';

export type InfrastructureResourceKind = 'host' | 'network' | 'service' | 'platform';
export type InfrastructureResourceStatus =
  'active' | 'planned' | 'retired' | 'archived' | 'decommissioning';

export interface InfrastructureResourceLink {
  label: string;
  kind: string;
  url?: string;
  privateRef?: string;
}

export interface InfrastructureResource {
  id: string;
  kind: InfrastructureResourceKind;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  status: InfrastructureResourceStatus;
  groups: string[];
  usagePriority?: number | null;
  homepage?: Pick<HomepageConfig, 'enabled' | 'featured' | 'order' | 'label' | 'description'>;
  hostRef?: string;
  parentResourceId?: string;
  hostResourceId?: string;
  provider?: string;
  region?: string;
  role?: string;
  roleEn?: string;
  details?: Partial<Record<'cpu' | 'memory' | 'storage' | 'os' | 'network', string>>;
  privateValues?: Record<string, string>;
  links?: InfrastructureResourceLink[];
}

export interface InfrastructureConnection {
  from: string;
  to: string;
  kind: string;
}

export interface InfraPublicV2 {
  schemaVersion: 2;
  product: 'infra-public-v2';
  generated: true;
  editable: false;
  producer: 'pds://system/component/personal-infrastructure';
  source: {
    repository: 'https://github.com/BakerSean168/personal-infrastructure.git';
    revision: string;
  };
  payload: {
    hosts: Array<{
      id: string;
      provider: string;
      region?: string;
      roles: string[];
    }>;
    deployments: Array<{
      componentRef: string;
      environments: Array<{
        name: string;
        host: string;
        runtime: string;
        lifecycle: string;
        desiredState: 'active' | 'planned' | 'retired';
        publicUrls?: string[];
      }>;
    }>;
    resources: InfrastructureResource[];
    connections: InfrastructureConnection[];
    summary: {
      hostCount: number;
      deploymentCount: number;
      activeEnvironmentCount: number;
      resourceCount: number;
      activeResourceCount: number;
      connectionCount: number;
    };
  };
}

const SOURCE_REPOSITORY = 'https://github.com/BakerSean168/personal-infrastructure.git';
const PRIVATE_REF_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const RESOURCE_ID_RE = /^(?:host|net|svc)-[a-z0-9][a-z0-9-]*$/;

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${label} must be a string array`);
  }
}

function assertPublicUrl(value: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} must use http(s)`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not embed credentials`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname.endsWith('.ts.net') ||
    hostname.endsWith('.local') ||
    /^\d+(?:\.\d+){3}$/.test(hostname)
  ) {
    throw new Error(`${label} must be public-safe`);
  }
}

export function parseInfraPublicV2(raw: string): InfraPublicV2 {
  const value: unknown = JSON.parse(raw);
  assertRecord(value, 'infra-public-v2');
  if (
    value.schemaVersion !== 2 ||
    value.product !== 'infra-public-v2' ||
    value.generated !== true ||
    value.editable !== false ||
    value.producer !== 'pds://system/component/personal-infrastructure'
  ) {
    throw new Error('infra-public-v2 envelope mismatch');
  }

  assertRecord(value.source, 'infra-public-v2.source');
  if (
    value.source.repository !== SOURCE_REPOSITORY ||
    typeof value.source.revision !== 'string' ||
    !/^[0-9a-f]{40}$/.test(value.source.revision)
  ) {
    throw new Error('infra-public-v2 source provenance is invalid');
  }

  assertRecord(value.payload, 'infra-public-v2.payload');
  if (
    !Array.isArray(value.payload.hosts) ||
    !Array.isArray(value.payload.deployments) ||
    !Array.isArray(value.payload.resources) ||
    !Array.isArray(value.payload.connections)
  ) {
    throw new Error('infra-public-v2 payload shape is invalid');
  }
  assertRecord(value.payload.summary, 'infra-public-v2.payload.summary');

  const resources = value.payload.resources;
  const ids = new Set<string>();
  let activeResources = 0;

  for (const [index, resource] of resources.entries()) {
    assertRecord(resource, `infra-public-v2.resources[${index}]`);
    assertString(resource.id, `resource[${index}].id`);
    if (!RESOURCE_ID_RE.test(resource.id)) {
      throw new Error(`invalid infrastructure resource id: ${resource.id}`);
    }
    if (ids.has(resource.id)) {
      throw new Error(`duplicate infrastructure resource id: ${resource.id}`);
    }
    ids.add(resource.id);

    if (!['host', 'network', 'service', 'platform'].includes(String(resource.kind))) {
      throw new Error(`${resource.id}.kind is invalid`);
    }
    assertString(resource.title, `${resource.id}.title`);
    if (typeof resource.description !== 'string') {
      throw new Error(`${resource.id}.description must be a string`);
    }
    if (
      !['active', 'planned', 'retired', 'archived', 'decommissioning'].includes(
        String(resource.status),
      )
    ) {
      throw new Error(`${resource.id}.status is invalid`);
    }
    assertStringArray(resource.groups, `${resource.id}.groups`);
    parseUsagePriority(resource.usagePriority);
    if (resource.homepage !== undefined) {
      assertRecord(resource.homepage, `${resource.id}.homepage`);
      for (const [key, field] of Object.entries(resource.homepage)) {
        if (key === 'enabled' || key === 'featured') {
          if (typeof field !== 'boolean')
            throw new Error(`${resource.id}.homepage.${key} must be boolean`);
        } else if (key === 'order') {
          if (typeof field !== 'number' || !Number.isInteger(field) || field < 0) {
            throw new Error(`${resource.id}.homepage.order must be a nonnegative integer`);
          }
        } else if (key === 'label' || key === 'description') {
          assertString(field, `${resource.id}.homepage.${key}`);
        } else {
          throw new Error(`${resource.id}.homepage.${key} is unsupported`);
        }
      }
    }
    if (resource.status === 'active') activeResources += 1;

    if (resource.privateValues !== undefined) {
      assertRecord(resource.privateValues, `${resource.id}.privateValues`);
      for (const [key, ref] of Object.entries(resource.privateValues)) {
        assertString(key, `${resource.id}.privateValues key`);
        if (typeof ref !== 'string' || !PRIVATE_REF_RE.test(ref)) {
          throw new Error(`${resource.id}.privateValues.${key} is invalid`);
        }
      }
    }

    if (resource.links !== undefined) {
      if (!Array.isArray(resource.links)) {
        throw new Error(`${resource.id}.links must be an array`);
      }
      for (const [linkIndex, link] of resource.links.entries()) {
        assertRecord(link, `${resource.id}.links[${linkIndex}]`);
        assertString(link.label, `${resource.id}.links[${linkIndex}].label`);
        assertString(link.kind, `${resource.id}.links[${linkIndex}].kind`);
        const hasUrl = typeof link.url === 'string';
        const hasPrivateRef = typeof link.privateRef === 'string';
        if (hasUrl === hasPrivateRef) {
          throw new Error(`${resource.id}.links[${linkIndex}] must set exactly one target`);
        }
        if (hasUrl) assertPublicUrl(link.url as string, `${resource.id}.links[${linkIndex}].url`);
        if (hasPrivateRef && !PRIVATE_REF_RE.test(link.privateRef as string)) {
          throw new Error(`${resource.id}.links[${linkIndex}].privateRef is invalid`);
        }
      }
    }
  }

  for (const resource of resources as Array<Record<string, unknown>>) {
    for (const key of ['parentResourceId', 'hostResourceId'] as const) {
      const ref = resource[key];
      if (ref !== undefined && (typeof ref !== 'string' || !ids.has(ref))) {
        throw new Error(`${resource.id}.${key} references a missing resource`);
      }
    }
  }

  const seenConnections = new Set<string>();
  for (const [index, connection] of value.payload.connections.entries()) {
    assertRecord(connection, `connection[${index}]`);
    assertString(connection.from, `connection[${index}].from`);
    assertString(connection.to, `connection[${index}].to`);
    assertString(connection.kind, `connection[${index}].kind`);
    if (!ids.has(connection.from) || !ids.has(connection.to)) {
      throw new Error(`connection[${index}] references a missing resource`);
    }
    const key = `${connection.from}|\0|${connection.to}|\0|${connection.kind}`;
    if (seenConnections.has(key)) throw new Error('duplicate infrastructure connection');
    seenConnections.add(key);
  }

  const summary = value.payload.summary;
  if (
    summary.resourceCount !== resources.length ||
    summary.activeResourceCount !== activeResources ||
    summary.connectionCount !== value.payload.connections.length ||
    summary.hostCount !== value.payload.hosts.length ||
    summary.deploymentCount !== value.payload.deployments.length
  ) {
    throw new Error('infra-public-v2 summary does not match payload contents');
  }

  return value as unknown as InfraPublicV2;
}
