import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseKnowledgePublicV1 } from './knowledge-public-v1';

type LegacyNote = {
  filePath: string;
  title: string;
  tags: string[];
  aliases: string[];
  visibility?: string;
  draft: boolean;
  private: boolean;
  isAsset: boolean;
  asset_id?: string;
};

type LegacyNotesIndex = { entries: LegacyNote[] };
type LegacyAssetIndex = { entries: LegacyNote[] };

export function toLegacyFilePath(sourcePath: string): string | null {
  const normalized = sourcePath.replace(/\\/g, '/');
  if (normalized.startsWith('z/')) return normalized.slice(2);
  if (
    normalized.startsWith('assets/') ||
    normalized.startsWith('config/') ||
    normalized.startsWith('blogs/')
  ) {
    return normalized;
  }
  return null;
}

export function readPinnedThoughtForestRevision(legacyRoot: string): string {
  const output = execFileSync('git', ['-C', legacyRoot, 'ls-files', '-s', 'thought-forest'], {
    encoding: 'utf8',
  }).trim();
  const match = /^160000\s+([0-9a-f]{40})\s+0\s+thought-forest$/m.exec(output);
  if (!match) {
    throw new Error(
      'legacy Digital Biome checkout does not contain a pinned thought-forest gitlink',
    );
  }
  return match[1];
}

export function readLegacySourceRevision(legacyRoot: string): string {
  const manifestPath = path.join(legacyRoot, '.pds-data-product-snapshot.json');
  if (!fs.existsSync(manifestPath)) return readPinnedThoughtForestRevision(legacyRoot);

  const manifest: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('legacy snapshot manifest must be an object');
  }
  const record = manifest as Record<string, unknown>;
  if (
    record.schemaVersion !== 1 ||
    record.product !== 'knowledge-public-v1-legacy-snapshot' ||
    typeof record.sourceRevision !== 'string' ||
    !/^[0-9a-f]{40}$/.test(record.sourceRevision)
  ) {
    throw new Error('legacy snapshot manifest provenance is invalid');
  }
  return record.sourceRevision;
}

export function assertKnowledgeSourceRevision(
  projectionRevision: string,
  legacyRevision: string,
): void {
  assert.equal(
    projectionRevision,
    legacyRevision,
    `knowledge-public-v1 source revision ${projectionRevision} does not match legacy thought-forest revision ${legacyRevision}`,
  );
}

export function verifyKnowledgePublicParity(
  artifactPath: string,
  legacyRoot: string,
): { compared: number; publicAssets: number; sourceRevision: string } {
  const projection = parseKnowledgePublicV1(fs.readFileSync(artifactPath, 'utf8'));
  const legacyRevision = readLegacySourceRevision(legacyRoot);
  assertKnowledgeSourceRevision(projection.source.revision, legacyRevision);
  const indexesRoot = path.join(legacyRoot, 'src', 'data', 'indexes');
  const legacyNotes = JSON.parse(
    fs.readFileSync(path.join(indexesRoot, 'notes-index.json'), 'utf8'),
  ) as LegacyNotesIndex;
  const legacyAssets = JSON.parse(
    fs.readFileSync(path.join(indexesRoot, 'asset-index.json'), 'utf8'),
  ) as LegacyAssetIndex;

  const projectionByFile = new Map(
    projection.payload.notes
      .map((note) => [toLegacyFilePath(note.sourcePath), note] as const)
      .filter(
        (entry): entry is [string, (typeof projection.payload.notes)[number]] => entry[0] !== null,
      ),
  );

  let compared = 0;
  for (const legacy of legacyNotes.entries) {
    if (
      legacy.draft ||
      legacy.private ||
      legacy.visibility === 'private' ||
      legacy.visibility === 'internal'
    ) {
      continue;
    }
    const projected = projectionByFile.get(legacy.filePath.replace(/\\/g, '/'));
    assert.ok(projected, `${legacy.filePath}: missing from knowledge-public-v1`);
    assert.equal(projected.visibility, 'public', `${legacy.filePath}: projection visibility drift`);
    assert.equal(projected.title, legacy.title, `${legacy.filePath}: title drift`);
    assert.deepEqual(projected.tags, legacy.tags, `${legacy.filePath}: tag drift`);
    assert.deepEqual(projected.aliases, legacy.aliases, `${legacy.filePath}: alias drift`);
    compared += 1;
  }

  const projectedAssetIds = new Set(projection.payload.assets.map((asset) => asset.assetId));
  const publicLegacyAssetIds = legacyAssets.entries
    .filter(
      (asset) =>
        !asset.draft &&
        !asset.private &&
        asset.visibility !== 'private' &&
        asset.visibility !== 'internal' &&
        typeof asset.asset_id === 'string',
    )
    .map((asset) => asset.asset_id as string);
  for (const assetId of publicLegacyAssetIds) {
    assert.ok(
      projectedAssetIds.has(assetId),
      `${assetId}: missing from knowledge-public-v1 assets`,
    );
  }

  assert.ok(compared > 0, 'expected at least one public legacy note to compare');
  return {
    compared,
    publicAssets: publicLegacyAssetIds.length,
    sourceRevision: projection.source.revision,
  };
}

function cli(): void {
  const artifactPath = process.argv[2]?.trim();
  const legacyRoot = process.argv[3]?.trim() || process.cwd();
  if (!artifactPath) {
    throw new Error(
      'usage: tsx scripts/data-products/verify-knowledge-public-v1-parity.ts <knowledge-public-v1.json> [legacy-root]',
    );
  }
  const result = verifyKnowledgePublicParity(path.resolve(artifactPath), path.resolve(legacyRoot));
  console.log(
    `knowledge-public-v1 parity=PASS revision=${result.sourceRevision} notes=${result.compared} assets=${result.publicAssets}`,
  );
}

if (process.argv[1]?.endsWith('verify-knowledge-public-v1-parity.ts')) cli();
