import fs from 'node:fs';
import path from 'node:path';
import {
  infraProjectionSummary,
  materializeInfraPublicV1,
  parseInfraPublicV1,
} from './infra-public-v1';

function resolveArtifactPath(): string {
  const positional = process.argv.slice(2).find(arg => !arg.startsWith('--'))?.trim();
  const configured = positional || process.env.INFRA_PUBLIC_V1_ARTIFACT?.trim();
  if (!configured) {
    throw new Error(
      'usage: tsx scripts/data-products/sync-infra-public-v1.ts <infra-public-v1.json> [--dry-run]',
    );
  }
  return path.resolve(configured);
}

function resolveOutputPath(): string {
  const configured = process.env.INFRA_PUBLIC_V1_OUTPUT?.trim();
  return path.resolve(configured || 'src/data/infrastructure/infra-public-v1.json');
}

function main(): void {
  const artifactPath = resolveArtifactPath();
  const dryRun = process.argv.includes('--dry-run');
  const projection = parseInfraPublicV1(fs.readFileSync(artifactPath, 'utf8'));
  const summary = infraProjectionSummary(projection);

  if (!dryRun) {
    materializeInfraPublicV1(projection, resolveOutputPath());
  }

  console.log(
    `infra-public-v1 consumer=PASS revision=${summary.sourceRevision} hosts=${summary.hosts} deployments=${summary.deployments} activeEnvironments=${summary.activeEnvironments} mode=${dryRun ? 'dry-run' : 'materialize'}`,
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
