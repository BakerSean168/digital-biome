import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertRecord,
  canonicalLockIdentity,
  parseDataProductPublished,
  parsePublicDataProductLock,
} from './lock-v1';
import { publicDataProducts } from './registry';
import { readPublicDataProductRelease, releaseSourceRevision } from './fetch-release';
import {
  createGitHubReleaseTransport,
  githubReadToken,
  type GitHubReleaseTransport,
} from './github-release-transport';

export function enabledProduct(product: unknown) {
  const definition = publicDataProducts.find((d) => d.product === product);
  if (!definition) throw new Error('Unknown public product');
  if (!definition.genericConsumption)
    throw new Error(`${definition.product} is not yet enabled for generic consumption`);
  return definition;
}

export function parseSyncRequest(mode: string, value: unknown) {
  assertRecord(value, 'sync request');
  if (mode === 'event') {
    if (value.action !== 'data-product-published') throw new Error('Unexpected dispatch type');
    const identity = parseDataProductPublished(value.client_payload);
    enabledProduct(identity.product);
    return { product: identity.product, releaseTag: identity.releaseTag, identity };
  }
  if (mode === 'exact') {
    const definition = enabledProduct(value.product);
    const revision = releaseSourceRevision(definition.product, value.release_tag);
    return { product: definition.product, releaseTag: `${definition.product}-${revision}` };
  }
  if (mode === 'reconcile') return { product: enabledProduct(value.product).product };
  throw new Error('Unknown sync mode');
}

/** One event/manual/reconciliation lock-generation path. No annotations or timestamps. */
export async function computeNextLock(
  mode: string,
  value: unknown,
  transport: GitHubReleaseTransport,
) {
  const request = parseSyncRequest(mode, value);
  const publication = await readPublicDataProductRelease(request, transport);
  const serialized = `${JSON.stringify(publication.identity, null, 2)}\n`;
  return {
    publication,
    serialized,
    lockPath: enabledProduct(publication.identity.product).lockPath,
  };
}

export function updatePublicDataProductLock(
  next: Awaited<ReturnType<typeof computeNextLock>>,
  root = process.cwd(),
): boolean {
  const definition = enabledProduct(next.publication.identity.product);
  if (next.lockPath !== definition.lockPath) throw new Error('Unexpected lock write path');
  const lockPath = path.join(root, definition.lockPath);
  const current = parsePublicDataProductLock(JSON.parse(fs.readFileSync(lockPath, 'utf8')));
  if (current.product !== definition.product) throw new Error('Current lock product mismatch');
  if (canonicalLockIdentity(current) === next.publication.canonicalIdentity) return false;
  if (current.releaseTag === next.publication.identity.releaseTag)
    throw new Error('Immutable Release identity drift');
  // A single file is the entire mutation boundary; verification precedes any write.
  const stage = fs.mkdtempSync(path.join(path.dirname(lockPath), '.data-product-lock-'));
  const temporary = path.join(stage, 'next.json');
  try {
    fs.writeFileSync(temporary, next.serialized, { flag: 'wx' });
    fs.renameSync(temporary, lockPath);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const routeOnly = args[0] === 'route';
  if (routeOnly) args.shift();
  const [mode, product, tag] = args;
  let value: unknown;
  let requestMode = mode;
  if (mode === 'event') {
    if (process.env.GITHUB_EVENT_NAME !== 'repository_dispatch')
      throw new Error('Expected repository_dispatch');
    value = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8'));
  } else if (mode === 'manual') {
    if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch')
      throw new Error('Expected workflow_dispatch');
    const event: unknown = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8'));
    assertRecord(event, 'workflow event');
    value = event.inputs;
    requestMode = 'exact';
  } else if (mode === 'reconcile') {
    value = { product };
  } else if (mode === 'shadow') {
    value = { product, release_tag: tag };
    requestMode = 'exact';
  } else
    throw new Error('usage: update-lock.ts [route] event|manual|reconcile|shadow [product tag]');
  // Route before issuing a producer token. Every output is registry-owned, not event text.
  const request = parseSyncRequest(requestMode, value);
  if (routeOnly) {
    const definition = enabledProduct(request.product);
    if (!process.env.GITHUB_OUTPUT) throw new Error('Route requires GITHUB_OUTPUT');
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `mode=${mode}\nproduct=${definition.product}\nproducer_repository=${definition.producerRepository.split('/')[1]}\nbranch=automation/data-product-${definition.product}\nlock_path=${definition.lockPath}\n`,
    );
    return;
  }
  const next = await computeNextLock(
    requestMode,
    value,
    createGitHubReleaseTransport(githubReadToken()),
  );
  if (mode === 'shadow') {
    process.stdout.write(next.serialized);
    console.error(
      `shadow=PASS releaseId=${next.publication.releaseId} publishedAt=${next.publication.publishedAt}`,
    );
    return;
  }
  const changed = updatePublicDataProductLock(next);
  const identity = next.publication.identity;
  console.log(
    `verification=PASS changed=${changed} product=${identity.product} release=${identity.releaseTag} semantic=${identity.semanticSha256}`,
  );
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `changed=${changed}\nsource_revision=${identity.sourceRevision}\nrelease_tag=${identity.releaseTag}\n`,
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
