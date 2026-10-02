import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const KNOWLEDGE_PUBLIC_V1_REPOSITORY = 'https://github.com/BakerSean168/thought-forest.git';

export type KnowledgePublicNote = {
  id: string;
  collection: 'knowledge' | 'asset' | 'docs' | 'config' | 'blog';
  sourcePath: string;
  slug: string;
  title: string;
  aliases: string[];
  description?: string;
  tags: string[];
  noteType?: string;
  status?: string;
  visibility: string;
  created?: string;
  updated?: string;
  isAsset: boolean;
  isMoc: boolean;
  markdown: string;
};

export type KnowledgePublicAsset = {
  assetId: string;
  assetType: string;
  sourceId: string;
  title: string;
  visibility: string;
  links: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type KnowledgePublicV1 = {
  schemaVersion: number;
  product: string;
  generated: boolean;
  editable: boolean;
  producer: string;
  source: { repository: string; revision: string };
  payload: {
    notes: KnowledgePublicNote[];
    assets: KnowledgePublicAsset[];
    tags: Array<{ tag: string; count: number; samplePaths: string[] }>;
    linkGraph: Array<{
      sourceId: string;
      outgoing: Array<Record<string, unknown>>;
      backlinks: string[];
    }>;
    media: Array<{ path: string; mediaType: string; sha256: string; dataBase64: string }>;
  };
};

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be a string array`);
  }
}

function assertSafeRelativePath(value: string, label: string): string {
  if (
    !value ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    value.split('/').some((segment) => segment === '..' || segment === '.' || segment === '')
  ) {
    throw new Error(`${label} must be a normalized relative POSIX path`);
  }
  return value;
}

function assertProjectionShape(projection: KnowledgePublicV1): void {
  const seenIds = new Set<string>();
  const seenSourcePaths = new Set<string>();

  for (const note of projection.payload.notes) {
    assertRecord(note, 'knowledge-public-v1 note');
    if (
      typeof note.id !== 'string' ||
      typeof note.sourcePath !== 'string' ||
      typeof note.title !== 'string' ||
      typeof note.markdown !== 'string' ||
      note.visibility !== 'public'
    ) {
      throw new Error('knowledge-public-v1 contains an invalid public note');
    }
    assertSafeRelativePath(note.sourcePath, `${note.id}.sourcePath`);
    assertStringArray(note.aliases, `${note.id}.aliases`);
    assertStringArray(note.tags, `${note.id}.tags`);
    if (seenIds.has(note.id)) throw new Error(`knowledge-public-v1 duplicate note id: ${note.id}`);
    if (seenSourcePaths.has(note.sourcePath)) {
      throw new Error(`knowledge-public-v1 duplicate source path: ${note.sourcePath}`);
    }
    seenIds.add(note.id);
    seenSourcePaths.add(note.sourcePath);
  }

  const seenAssetIds = new Set<string>();
  for (const asset of projection.payload.assets) {
    assertRecord(asset, 'knowledge-public-v1 asset');
    if (
      typeof asset.assetId !== 'string' ||
      !asset.assetId ||
      typeof asset.assetType !== 'string' ||
      !asset.assetType ||
      typeof asset.sourceId !== 'string' ||
      !asset.sourceId ||
      typeof asset.title !== 'string' ||
      asset.visibility !== 'public' ||
      !Array.isArray(asset.links)
    ) {
      throw new Error('knowledge-public-v1 contains an invalid public asset');
    }
    if (seenAssetIds.has(asset.assetId)) {
      throw new Error(`knowledge-public-v1 duplicate asset id: ${asset.assetId}`);
    }
    if (!seenIds.has(asset.sourceId)) {
      throw new Error(
        `knowledge-public-v1 asset source note is missing: ${asset.assetId} -> ${asset.sourceId}`,
      );
    }
    seenAssetIds.add(asset.assetId);
  }

  const seenMedia = new Set<string>();
  for (const media of projection.payload.media) {
    assertRecord(media, 'knowledge-public-v1 media');
    if (
      typeof media.path !== 'string' ||
      typeof media.mediaType !== 'string' ||
      typeof media.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(media.sha256) ||
      typeof media.dataBase64 !== 'string'
    ) {
      throw new Error('knowledge-public-v1 contains invalid media metadata');
    }
    assertSafeRelativePath(media.path, `media ${media.path || '<empty>'}`);
    if (media.path.includes('/')) {
      throw new Error(`knowledge-public-v1 media path must be a basename: ${media.path}`);
    }
    if (seenMedia.has(media.path)) {
      throw new Error(`knowledge-public-v1 duplicate media path: ${media.path}`);
    }
    seenMedia.add(media.path);
  }
}

export function parseKnowledgePublicV1(raw: string): KnowledgePublicV1 {
  const value: unknown = JSON.parse(raw);
  assertRecord(value, 'knowledge-public-v1');
  if (
    value.schemaVersion !== 1 ||
    value.product !== 'knowledge-public-v1' ||
    value.generated !== true ||
    value.editable !== false ||
    value.producer !== 'pds://system/component/thought-forest'
  ) {
    throw new Error('knowledge-public-v1 envelope mismatch');
  }
  assertRecord(value.source, 'knowledge-public-v1.source');
  if (
    value.source.repository !== KNOWLEDGE_PUBLIC_V1_REPOSITORY ||
    typeof value.source.revision !== 'string' ||
    !/^[0-9a-f]{40}$/.test(value.source.revision)
  ) {
    throw new Error('knowledge-public-v1 source provenance is invalid');
  }
  assertRecord(value.payload, 'knowledge-public-v1.payload');
  for (const key of ['notes', 'assets', 'tags', 'linkGraph', 'media'] as const) {
    if (!Array.isArray(value.payload[key])) {
      throw new Error(`knowledge-public-v1.payload.${key} must be an array`);
    }
  }
  const projection = value as KnowledgePublicV1;
  assertProjectionShape(projection);
  return projection;
}

export function knowledgeProjectionSummary(projection: KnowledgePublicV1) {
  return {
    sourceRevision: projection.source.revision,
    notes: projection.payload.notes.length,
    assets: projection.payload.assets.length,
    tags: projection.payload.tags.length,
    links: projection.payload.linkGraph.length,
    media: projection.payload.media.length,
  };
}

export function knowledgePublicIds(projection: KnowledgePublicV1): Set<string> {
  return new Set(projection.payload.notes.map((note) => note.id));
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function withAssetRoutingFrontmatter(
  markdown: string,
  asset: KnowledgePublicAsset | undefined,
): string {
  if (!asset) return markdown;
  if (!markdown.startsWith('---\n')) {
    throw new Error(`knowledge-public-v1 asset markdown is missing frontmatter: ${asset.assetId}`);
  }
  const closing = markdown.indexOf('\n---\n', 4);
  if (closing < 0) {
    throw new Error(
      `knowledge-public-v1 asset markdown frontmatter is malformed: ${asset.assetId}`,
    );
  }
  const header = markdown.slice(4, closing);
  const body = markdown.slice(closing + '\n---\n'.length);
  return [
    '---',
    header,
    `asset_id: ${JSON.stringify(asset.assetId)}`,
    `asset_type: ${JSON.stringify(asset.assetType)}`,
    '---',
    body,
  ].join('\n');
}

export function materializeKnowledgePublicV1Source(
  projection: KnowledgePublicV1,
  outputRoot: string,
): {
  sourceRoot: string;
  sourceRevision: string;
  notes: number;
  assets: number;
  media: number;
} {
  assertProjectionShape(projection);
  const sourceRoot = path.resolve(outputRoot);
  if (fs.existsSync(sourceRoot) && fs.readdirSync(sourceRoot).length > 0) {
    throw new Error(`knowledge-public-v1 materialization root must be empty: ${sourceRoot}`);
  }
  fs.mkdirSync(sourceRoot, { recursive: true });

  for (const directory of ['z', 'assets', 'config', 'blogs', 'sources/attachments']) {
    fs.mkdirSync(path.join(sourceRoot, directory), { recursive: true });
  }

  const assetBySourceId = new Map(
    projection.payload.assets.map((asset) => [asset.sourceId, asset] as const),
  );
  for (const note of projection.payload.notes) {
    if (
      !['z/', 'assets/', 'config/', 'blogs/'].some((prefix) => note.sourcePath.startsWith(prefix))
    ) {
      continue;
    }
    const relativePath = assertSafeRelativePath(note.sourcePath, `${note.id}.sourcePath`);
    const destination = path.join(sourceRoot, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const markdown = withAssetRoutingFrontmatter(note.markdown, assetBySourceId.get(note.id));
    fs.writeFileSync(destination, markdown, 'utf8');
  }

  for (const media of projection.payload.media) {
    const data = Buffer.from(media.dataBase64, 'base64');
    const actualSha256 = crypto.createHash('sha256').update(data).digest('hex');
    if (actualSha256 !== media.sha256) {
      throw new Error(`knowledge-public-v1 media digest mismatch: ${media.path}`);
    }
    fs.writeFileSync(path.join(sourceRoot, 'sources', 'attachments', media.path), data);
  }

  const indexRoot = path.join(sourceRoot, 'generated', 'knowledge-index');
  const indexedNotes = projection.payload.notes
    .filter((note) => note.collection !== 'blog')
    .map(({ markdown: _markdown, collection: _collection, ...note }) => note);
  writeJson(path.join(indexRoot, 'notes-index.json'), indexedNotes);
  writeJson(path.join(indexRoot, 'asset-index.json'), projection.payload.assets);
  writeJson(path.join(indexRoot, 'link-graph.json'), projection.payload.linkGraph);
  writeJson(path.join(indexRoot, 'tag-index.json'), projection.payload.tags);

  writeJson(path.join(sourceRoot, '.pds-data-product-source.json'), {
    schemaVersion: 1,
    product: 'knowledge-public-v1-consumer-source',
    source: projection.source,
    generated: true,
    editable: false,
  });

  return {
    sourceRoot,
    sourceRevision: projection.source.revision,
    notes: projection.payload.notes.length,
    assets: projection.payload.assets.length,
    media: projection.payload.media.length,
  };
}
