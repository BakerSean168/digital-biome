import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  CANDIDATE_SCHEMA,
  RELEASE_SCHEMA,
  validateCandidate,
  validateReleaseManifest,
} from './manifest';
import { assertRecord, parsePublicDataProductLock } from '../data-products/lock-v1';
import { publicDataProducts } from '../data-products/registry';
import {
  DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT,
  parseDigitalBiomePrivateInfrastructureLock,
} from '../data-products/private-infrastructure-lock';
import { prepareAllPublicDataProducts } from '../data-products/prepare-all';
import {
  createGitHubReleaseTransport,
  githubReadToken,
} from '../data-products/github-release-transport';

/** Compare complete identities before any fetch or materialization, not only source revisions. */
export function assertCommittedInputs(value: unknown, root: string) {
  assertRecord(value, 'manifest');
  if (![CANDIDATE_SCHEMA, RELEASE_SCHEMA].includes(String(value.schema)))
    throw new Error('v5 manifest required');
  const errors =
    value.schema === CANDIDATE_SCHEMA ? validateCandidate(value) : validateReleaseManifest(value);
  if (errors.length) throw new Error(errors.join('; '));
  assertRecord(value.dataProducts, 'dataProducts');
  assertRecord(value.privateBindings, 'privateBindings');
  for (const definition of publicDataProducts) {
    const lock = parsePublicDataProductLock(
      JSON.parse(fs.readFileSync(path.join(root, definition.lockPath), 'utf8')),
    );
    if (!isDeepStrictEqual(lock, value.dataProducts[definition.product]))
      throw new Error(`${definition.product} committed lock mismatch`);
  }
  const privateLock = parseDigitalBiomePrivateInfrastructureLock(
    fs.readFileSync(
      path.join(root, `data-products/${DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT}.lock.json`),
      'utf8',
    ),
  );
  if (
    !isDeepStrictEqual(
      privateLock,
      value.privateBindings[DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT],
    )
  )
    throw new Error('private binding committed lock mismatch');
  return privateLock;
}

async function main() {
  const [file, privateRoot, ...extra] = process.argv.slice(2);
  if (!file || !privateRoot || extra.length)
    throw new Error('usage: revalidate.ts <manifest> <private-checkout>');
  const root = process.cwd();
  const lock = assertCommittedInputs(JSON.parse(fs.readFileSync(file, 'utf8')), root);
  const revision = execFileSync('git', ['-C', privateRoot, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    timeout: 10_000,
  }).trim();
  if (revision !== lock.sourceRevision) throw new Error('private checkout revision mismatch');
  const contract = path.join(privateRoot, lock.contractPath);
  const actual = `sha256:${createHash('sha256').update(fs.readFileSync(contract)).digest('hex')}`;
  if (actual !== lock.sha256) throw new Error('private binding digest mismatch');
  const { sourceRoot } = await prepareAllPublicDataProducts(
    createGitHubReleaseTransport(githubReadToken()),
    root,
  );
  const env = {
    NOTES_VAULT_ROOT: sourceRoot,
    NOTES_UPSTREAM_GENERATED: path.join(sourceRoot, 'generated'),
    PDS_PUBLIC_INFRASTRUCTURE_ARTIFACT: path.join(
      root,
      'src/data/infrastructure/infra-public-v2.json',
    ),
    PDS_PRIVATE_INFRASTRUCTURE_BINDING: contract,
  };
  // Domain-owned coverage checks consume the verified public/private inputs; no static build.
  execFileSync(
    'pnpm',
    ['exec', 'tsx', '--test', 'scripts/private-infrastructure-binding.test.ts'],
    {
      env: { ...process.env, ...env },
      stdio: 'inherit',
      timeout: 120_000,
    },
  );
  if (process.env.GITHUB_ENV)
    fs.appendFileSync(
      process.env.GITHUB_ENV,
      Object.entries(env)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(''),
    );
  console.log('V5_INPUT_REVALIDATION=PASS');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Input revalidation failed');
    process.exitCode = 1;
  });
}
