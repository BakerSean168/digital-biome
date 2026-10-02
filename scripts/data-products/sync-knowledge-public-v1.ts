import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { materializeKnowledgePublicV1Source, parseKnowledgePublicV1 } from './knowledge-public-v1';

function resolveArtifactPath(): string {
  const positional = process.argv
    .slice(2)
    .find((arg) => !arg.startsWith('--'))
    ?.trim();
  const configured = positional || process.env.KNOWLEDGE_PUBLIC_V1_ARTIFACT?.trim();
  if (!configured) {
    throw new Error(
      'usage: tsx scripts/data-products/sync-knowledge-public-v1.ts <knowledge-public-v1.json> [--dry-run] [--with-favicons]',
    );
  }
  return path.resolve(configured);
}

async function main(): Promise<void> {
  const artifactPath = resolveArtifactPath();
  const dryRun = process.argv.includes('--dry-run');
  const withFavicons = process.argv.includes('--with-favicons');
  const projection = parseKnowledgePublicV1(fs.readFileSync(artifactPath, 'utf8'));

  const configuredSourceRoot = process.env.KNOWLEDGE_PUBLIC_V1_SOURCE_ROOT?.trim();
  let tempRoot: string | undefined;
  let sourceRoot: string;
  if (configuredSourceRoot) {
    sourceRoot = path.resolve(configuredSourceRoot);
  } else {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pds-knowledge-consumer-'));
    sourceRoot = path.join(tempRoot, 'thought-forest-public');
  }
  const materialized = materializeKnowledgePublicV1Source(projection, sourceRoot);

  process.env.NOTES_VAULT_ROOT = sourceRoot;
  process.env.NOTES_UPSTREAM_GENERATED = path.join(sourceRoot, 'generated');

  try {
    const { runSync } = await import('../sync/index');
    const errorCount = await runSync({ dryRun, withFavicons });
    if (!dryRun) {
      const { generateSubscriptionsJson } = await import('../sync/build-subscriptions');
      generateSubscriptionsJson();
    }
    if (errorCount > 0) {
      throw new Error(`knowledge-public-v1 consumer sync completed with ${errorCount} error(s)`);
    }
    console.log(
      `knowledge-public-v1 consumer=PASS revision=${materialized.sourceRevision} notes=${materialized.notes} assets=${materialized.assets} media=${materialized.media} mode=${dryRun ? 'dry-run' : 'materialize'} source=${sourceRoot}`,
    );
  } finally {
    if (tempRoot && process.env.PDS_KEEP_KNOWLEDGE_CONSUMER_SOURCE !== '1') {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } else {
      console.log(`knowledge-public-v1 consumer source preserved at ${sourceRoot}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
