import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicDataProducts } from './registry';
import { parsePublicDataProductLock } from './lock-v1';
import {
  createGitHubReleaseTransport,
  githubReadToken,
  type GitHubReleaseTransport,
} from './github-release-transport';
import { prepareKnowledgePublicV1 } from './prepare-knowledge-public-v1';
import { preparePdsCatalogV1 } from './prepare-pds-catalog-v1';
import { prepareInfraPublicV2 } from './prepare-infra-public-v2';
import { syncKnowledgeSource } from './sync-knowledge-public-v1';

/** Per-product failure atomicity, not an all-product filesystem transaction. */
export async function prepareAllPublicDataProducts(
  transport: GitHubReleaseTransport,
  root = process.cwd(),
  infraOutput = path.join(root, 'src/data/infrastructure/infra-public-v2.json'),
) {
  // Validate every committed identity before fetching or replacing any product.
  const inputs = publicDataProducts
    .filter((d) => d.genericConsumption)
    .map((definition) => {
      const raw = fs.readFileSync(path.join(root, definition.lockPath), 'utf8');
      const lock = parsePublicDataProductLock(JSON.parse(raw));
      if (lock.product !== definition.product) throw new Error('Lock path product mismatch');
      return { definition, raw, runtime: path.join(root, '.pds-runtime', definition.product) };
    });
  let sourceRoot = '';
  for (const { definition, raw, runtime } of inputs) {
    switch (definition.product) {
      case 'knowledge-public-v1':
        sourceRoot = (await prepareKnowledgePublicV1(raw, runtime, transport)).sourceRoot;
        break;
      case 'pds-catalog-v1':
        await preparePdsCatalogV1(
          raw,
          runtime,
          transport,
          path.join(root, 'src/data/system/pds-catalog-v1.json'),
        );
        break;
      case 'infra-public-v2':
        await prepareInfraPublicV2(raw, runtime, transport, infraOutput);
        break;
      default: {
        const unexpected: never = definition;
        throw new Error(`Missing public product adapter: ${unexpected}`);
      }
    }
    console.log(`${definition.product} prepare=PASS`);
  }
  return { sourceRoot };
}

async function main() {
  const flags = process.argv.slice(2).filter((flag) => flag !== '--');
  if (flags.some((flag) => !['--dry-run', '--with-favicons'].includes(flag)))
    throw new Error('usage: prepare-all.ts [--dry-run] [--with-favicons]');
  const prepared = await prepareAllPublicDataProducts(
    createGitHubReleaseTransport(githubReadToken()),
    process.cwd(),
    process.env.INFRA_PUBLIC_V2_OUTPUT?.trim() || undefined,
  );
  await syncKnowledgeSource(
    prepared.sourceRoot,
    flags.includes('--dry-run'),
    flags.includes('--with-favicons'),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
