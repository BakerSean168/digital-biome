import fs from 'node:fs';
import path from 'node:path';

export const INFRA_PUBLIC_V1_REPOSITORY =
  'https://github.com/BakerSean168/personal-infrastructure.git';

export type InfraPublicHost = {
  id: string;
  provider: string;
  region?: string;
  roles: string[];
};

export type InfraPublicEnvironment = {
  name: string;
  host: string;
  runtime: string;
  lifecycle: string;
  desiredState: 'active' | 'planned' | 'retired';
  publicUrls?: string[];
};

export type InfraPublicDeployment = {
  componentRef: string;
  environments: InfraPublicEnvironment[];
};

export type InfraPublicV1 = {
  schemaVersion: number;
  product: string;
  generated: boolean;
  editable: boolean;
  producer: string;
  source: {
    repository: string;
    revision: string;
  };
  payload: {
    hosts: InfraPublicHost[];
    deployments: InfraPublicDeployment[];
    summary: {
      hostCount: number;
      deploymentCount: number;
      activeEnvironmentCount: number;
    };
  };
};

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be a string array`);
  }
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} contains unexpected field(s): ${unexpected.join(', ')}`);
  }
}

function assertPublicUrl(value: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${label} must use http or https`);
  }
}

function assertProjectionShape(projection: InfraPublicV1): void {
  const hostIds = new Set<string>();
  for (const host of projection.payload.hosts) {
    assertRecord(host, 'infra-public-v1 host');
    assertOnlyKeys(host, ['id', 'provider', 'region', 'roles'], 'infra-public-v1 host');
    assertNonEmptyString(host.id, 'infra-public-v1 host.id');
    assertNonEmptyString(host.provider, `${host.id}.provider`);
    assertStringArray(host.roles, `${host.id}.roles`);
    if (host.region !== undefined && typeof host.region !== 'string') {
      throw new Error(`${host.id}.region must be a string`);
    }
    if (hostIds.has(host.id)) {
      throw new Error(`infra-public-v1 duplicate host id: ${host.id}`);
    }
    hostIds.add(host.id);
  }

  const componentRefs = new Set<string>();
  let activeEnvironmentCount = 0;
  for (const deployment of projection.payload.deployments) {
    assertRecord(deployment, 'infra-public-v1 deployment');
    assertOnlyKeys(deployment, ['componentRef', 'environments'], 'infra-public-v1 deployment');
    assertNonEmptyString(deployment.componentRef, 'infra-public-v1 deployment.componentRef');
    if (!/^pds:\/\/system\/component\/[a-z0-9][a-z0-9-]*$/.test(deployment.componentRef)) {
      throw new Error(`infra-public-v1 invalid component reference: ${deployment.componentRef}`);
    }
    if (!Array.isArray(deployment.environments)) {
      throw new Error(`${deployment.componentRef}.environments must be an array`);
    }
    if (componentRefs.has(deployment.componentRef)) {
      throw new Error(`infra-public-v1 duplicate deployment: ${deployment.componentRef}`);
    }
    componentRefs.add(deployment.componentRef);

    const environmentNames = new Set<string>();
    for (const environment of deployment.environments) {
      assertRecord(environment, `${deployment.componentRef} environment`);
      assertOnlyKeys(
        environment,
        ['name', 'host', 'runtime', 'lifecycle', 'desiredState', 'publicUrls'],
        `${deployment.componentRef} environment`,
      );
      assertNonEmptyString(environment.name, `${deployment.componentRef}.environment.name`);
      assertNonEmptyString(environment.host, `${deployment.componentRef}.${environment.name}.host`);
      assertNonEmptyString(
        environment.runtime,
        `${deployment.componentRef}.${environment.name}.runtime`,
      );
      assertNonEmptyString(
        environment.lifecycle,
        `${deployment.componentRef}.${environment.name}.lifecycle`,
      );
      if (!['active', 'planned', 'retired'].includes(environment.desiredState)) {
        throw new Error(`${deployment.componentRef}.${environment.name}.desiredState is invalid`);
      }
      if (!hostIds.has(environment.host)) {
        throw new Error(
          `infra-public-v1 deployment references unknown host: ${deployment.componentRef} -> ${environment.host}`,
        );
      }
      if (environmentNames.has(environment.name)) {
        throw new Error(
          `infra-public-v1 duplicate environment: ${deployment.componentRef} -> ${environment.name}`,
        );
      }
      environmentNames.add(environment.name);
      if (environment.desiredState === 'active') activeEnvironmentCount += 1;

      if (environment.publicUrls !== undefined) {
        assertStringArray(
          environment.publicUrls,
          `${deployment.componentRef}.${environment.name}.publicUrls`,
        );
        for (const [index, publicUrl] of environment.publicUrls.entries()) {
          assertPublicUrl(
            publicUrl,
            `${deployment.componentRef}.${environment.name}.publicUrls[${index}]`,
          );
        }
      }
    }
  }

  assertRecord(projection.payload.summary, 'infra-public-v1.payload.summary');
  assertOnlyKeys(
    projection.payload.summary,
    ['hostCount', 'deploymentCount', 'activeEnvironmentCount'],
    'infra-public-v1.payload.summary',
  );
  const { summary } = projection.payload;
  if (
    summary.hostCount !== projection.payload.hosts.length ||
    summary.deploymentCount !== projection.payload.deployments.length ||
    summary.activeEnvironmentCount !== activeEnvironmentCount
  ) {
    throw new Error('infra-public-v1 summary does not match payload contents');
  }
}

export function parseInfraPublicV1(raw: string): InfraPublicV1 {
  const value: unknown = JSON.parse(raw);
  assertRecord(value, 'infra-public-v1');
  assertOnlyKeys(
    value,
    ['schemaVersion', 'product', 'generated', 'editable', 'producer', 'source', 'payload'],
    'infra-public-v1',
  );
  if (
    value.schemaVersion !== 1 ||
    value.product !== 'infra-public-v1' ||
    value.generated !== true ||
    value.editable !== false ||
    value.producer !== 'pds://system/component/personal-infrastructure'
  ) {
    throw new Error('infra-public-v1 envelope mismatch');
  }

  assertRecord(value.source, 'infra-public-v1.source');
  assertOnlyKeys(value.source, ['repository', 'revision'], 'infra-public-v1.source');
  if (
    value.source.repository !== INFRA_PUBLIC_V1_REPOSITORY ||
    typeof value.source.revision !== 'string' ||
    !/^[0-9a-f]{40}$/.test(value.source.revision)
  ) {
    throw new Error('infra-public-v1 source provenance is invalid');
  }

  assertRecord(value.payload, 'infra-public-v1.payload');
  assertOnlyKeys(value.payload, ['hosts', 'deployments', 'summary'], 'infra-public-v1.payload');
  if (
    !Array.isArray(value.payload.hosts) ||
    !Array.isArray(value.payload.deployments) ||
    !value.payload.summary
  ) {
    throw new Error('infra-public-v1 payload shape is invalid');
  }

  const projection = value as InfraPublicV1;
  assertProjectionShape(projection);
  return projection;
}

export function infraProjectionSummary(projection: InfraPublicV1) {
  return {
    sourceRevision: projection.source.revision,
    hosts: projection.payload.hosts.length,
    deployments: projection.payload.deployments.length,
    activeEnvironments: projection.payload.summary.activeEnvironmentCount,
  };
}

export function materializeInfraPublicV1(projection: InfraPublicV1, outputPath: string): string {
  assertProjectionShape(projection);
  const destination = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
  return destination;
}
