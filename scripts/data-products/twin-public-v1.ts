import fs from 'node:fs';
import path from 'node:path';

export const TWIN_PUBLIC_V1_REPOSITORY = 'https://github.com/BakerSean168/personal-twin.git';

type TwinPublicEntity = {
  id: string;
  title: string;
  summary?: string;
  assetIds: string[];
};

export type TwinPublicSpace = TwinPublicEntity;

export type TwinPublicBodyProfile = TwinPublicEntity;

export type TwinPublicFurnitureLayout = TwinPublicEntity & {
  spaceId: string;
};

export type TwinPublicAsset = {
  id: string;
  kind: string;
  path: string;
  mediaType: string;
  sha256: string;
  title?: string;
};

export type TwinPublicV1 = {
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
    spaces: TwinPublicSpace[];
    bodyProfiles: TwinPublicBodyProfile[];
    furnitureLayouts: TwinPublicFurnitureLayout[];
    assets: TwinPublicAsset[];
  };
};

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const unexpected = Object.keys(value).filter(key => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} contains unexpected field(s): ${unexpected.join(', ')}`);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.length === 0)) {
    throw new Error(`${label} must be a non-empty-string array`);
  }
}

function assertSafeRelativePath(value: string, label: string): void {
  if (
    !value ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    value.split('/').some(segment => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`${label} must be a normalized relative POSIX path`);
  }
}

function assertEntity(
  value: unknown,
  label: string,
  seenIds: Set<string>,
  assetIds: Set<string>,
): asserts value is TwinPublicEntity {
  assertRecord(value, label);
  assertOnlyKeys(value, ['id', 'title', 'summary', 'assetIds'], label);
  assertNonEmptyString(value.id, `${label}.id`);
  assertNonEmptyString(value.title, `${label}.title`);
  if (value.summary !== undefined && typeof value.summary !== 'string') {
    throw new Error(`${label}.summary must be a string`);
  }
  assertStringArray(value.assetIds, `${label}.assetIds`);
  if (seenIds.has(value.id)) {
    throw new Error(`twin-public-v1 duplicate ${label} id: ${value.id}`);
  }
  seenIds.add(value.id);
  for (const assetId of value.assetIds) {
    if (!assetIds.has(assetId)) {
      throw new Error(`${label} references unknown asset: ${assetId}`);
    }
  }
}

function assertProjectionShape(projection: TwinPublicV1): void {
  const assetIds = new Set<string>();
  const assetPaths = new Set<string>();
  for (const asset of projection.payload.assets) {
    assertRecord(asset, 'twin-public-v1 asset');
    assertOnlyKeys(
      asset,
      ['id', 'kind', 'path', 'mediaType', 'sha256', 'title'],
      'twin-public-v1 asset',
    );
    assertNonEmptyString(asset.id, 'twin-public-v1 asset.id');
    assertNonEmptyString(asset.kind, `${asset.id}.kind`);
    assertNonEmptyString(asset.path, `${asset.id}.path`);
    assertSafeRelativePath(asset.path, `${asset.id}.path`);
    assertNonEmptyString(asset.mediaType, `${asset.id}.mediaType`);
    if (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
      throw new Error(`${asset.id}.sha256 must be a lowercase SHA-256 digest`);
    }
    if (asset.title !== undefined && typeof asset.title !== 'string') {
      throw new Error(`${asset.id}.title must be a string`);
    }
    if (assetIds.has(asset.id)) {
      throw new Error(`twin-public-v1 duplicate asset id: ${asset.id}`);
    }
    if (assetPaths.has(asset.path)) {
      throw new Error(`twin-public-v1 duplicate asset path: ${asset.path}`);
    }
    assetIds.add(asset.id);
    assetPaths.add(asset.path);
  }

  const spaceIds = new Set<string>();
  for (const space of projection.payload.spaces) {
    assertEntity(space, 'space', spaceIds, assetIds);
  }

  const bodyProfileIds = new Set<string>();
  for (const profile of projection.payload.bodyProfiles) {
    assertEntity(profile, 'body profile', bodyProfileIds, assetIds);
  }

  const layoutIds = new Set<string>();
  for (const layout of projection.payload.furnitureLayouts) {
    assertRecord(layout, 'furniture layout');
    assertOnlyKeys(
      layout,
      ['id', 'title', 'summary', 'assetIds', 'spaceId'],
      'furniture layout',
    );
    assertNonEmptyString(layout.id, 'furniture layout.id');
    assertNonEmptyString(layout.title, `${layout.id}.title`);
    assertNonEmptyString(layout.spaceId, `${layout.id}.spaceId`);
    if (!spaceIds.has(layout.spaceId)) {
      throw new Error(`furniture layout references unknown space: ${layout.spaceId}`);
    }
    if (layout.summary !== undefined && typeof layout.summary !== 'string') {
      throw new Error(`${layout.id}.summary must be a string`);
    }
    assertStringArray(layout.assetIds, `${layout.id}.assetIds`);
    for (const assetId of layout.assetIds) {
      if (!assetIds.has(assetId)) {
        throw new Error(`furniture layout references unknown asset: ${assetId}`);
      }
    }
    if (layoutIds.has(layout.id)) {
      throw new Error(`twin-public-v1 duplicate furniture layout id: ${layout.id}`);
    }
    layoutIds.add(layout.id);
  }
}

export function parseTwinPublicV1(raw: string): TwinPublicV1 {
  const value: unknown = JSON.parse(raw);
  assertRecord(value, 'twin-public-v1');
  assertOnlyKeys(
    value,
    ['schemaVersion', 'product', 'generated', 'editable', 'producer', 'source', 'payload'],
    'twin-public-v1',
  );
  if (
    value.schemaVersion !== 1 ||
    value.product !== 'twin-public-v1' ||
    value.generated !== true ||
    value.editable !== false ||
    value.producer !== 'pds://system/component/personal-twin'
  ) {
    throw new Error('twin-public-v1 envelope mismatch');
  }

  assertRecord(value.source, 'twin-public-v1.source');
  assertOnlyKeys(value.source, ['repository', 'revision'], 'twin-public-v1.source');
  if (
    value.source.repository !== TWIN_PUBLIC_V1_REPOSITORY ||
    typeof value.source.revision !== 'string' ||
    !/^[0-9a-f]{40}$/.test(value.source.revision)
  ) {
    throw new Error('twin-public-v1 source provenance is invalid');
  }

  assertRecord(value.payload, 'twin-public-v1.payload');
  assertOnlyKeys(
    value.payload,
    ['spaces', 'bodyProfiles', 'furnitureLayouts', 'assets'],
    'twin-public-v1.payload',
  );
  for (const key of ['spaces', 'bodyProfiles', 'furnitureLayouts', 'assets'] as const) {
    if (!Array.isArray(value.payload[key])) {
      throw new Error(`twin-public-v1.payload.${key} must be an array`);
    }
  }

  const projection = value as TwinPublicV1;
  assertProjectionShape(projection);
  return projection;
}

export function twinProjectionSummary(projection: TwinPublicV1) {
  return {
    sourceRevision: projection.source.revision,
    spaces: projection.payload.spaces.length,
    bodyProfiles: projection.payload.bodyProfiles.length,
    furnitureLayouts: projection.payload.furnitureLayouts.length,
    assets: projection.payload.assets.length,
  };
}

export function materializeTwinPublicV1(
  projection: TwinPublicV1,
  outputPath: string,
): string {
  assertProjectionShape(projection);
  const destination = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
  return destination;
}
