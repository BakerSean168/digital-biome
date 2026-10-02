import fs from 'node:fs';
import path from 'node:path';
import {
  materializeTwinPublicV1,
  parseTwinPublicV1,
  twinProjectionSummary,
} from './twin-public-v1';

function resolveArtifactPath(): string {
  const positional = process.argv
    .slice(2)
    .find((arg) => !arg.startsWith('--'))
    ?.trim();
  const configured = positional || process.env.TWIN_PUBLIC_V1_ARTIFACT?.trim();
  if (!configured) {
    throw new Error(
      'usage: tsx scripts/data-products/sync-twin-public-v1.ts <twin-public-v1.json> [--dry-run]',
    );
  }
  return path.resolve(configured);
}

function resolveOutputPath(): string {
  const configured = process.env.TWIN_PUBLIC_V1_OUTPUT?.trim();
  return path.resolve(configured || 'src/data/twin/twin-public-v1.json');
}

function main(): void {
  const artifactPath = resolveArtifactPath();
  const dryRun = process.argv.includes('--dry-run');
  const projection = parseTwinPublicV1(fs.readFileSync(artifactPath, 'utf8'));
  const summary = twinProjectionSummary(projection);

  if (!dryRun) {
    materializeTwinPublicV1(projection, resolveOutputPath());
  }

  console.log(
    `twin-public-v1 consumer=PASS revision=${summary.sourceRevision} spaces=${summary.spaces} bodyProfiles=${summary.bodyProfiles} furnitureLayouts=${summary.furnitureLayouts} assets=${summary.assets} mode=${dryRun ? 'dry-run' : 'materialize'}`,
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
