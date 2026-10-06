import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRecord, parsePublicDataProductLock } from './lock-v1';
import { assertTrustedLockPullRequest } from '../delivery/content-policy';
import { createGitHubReleaseTransport } from './github-release-transport';
import { readPublicDataProductRelease } from './fetch-release';

const repository = 'BakerSean168/digital-biome';
function gh(args: string[]) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 2 * 1024 * 1024,
  });
}
function api(route: string) {
  return JSON.parse(gh(['api', `repos/${repository}/${route}`])) as unknown;
}

async function main() {
  if (process.env.DATA_PRODUCT_AUTO_MERGE_ENABLED !== 'true') {
    console.log('AUTO_MERGE=DISABLED');
    return;
  }
  if (
    process.env.GITHUB_REPOSITORY !== repository ||
    process.env.GITHUB_REF !== 'refs/heads/main' ||
    ![
      `${repository}/.github/workflows/sync-data-products.yml@refs/heads/main`,
      `${repository}/.github/workflows/reconcile-data-products.yml@refs/heads/main`,
    ].includes(process.env.GITHUB_WORKFLOW_REF ?? '')
  )
    throw new Error('Untrusted auto-merge workflow provenance');
  const {
    PR_NUMBER: number,
    HEAD_SHA: sha,
    PRODUCT: product,
    CI_RUN_ID: runId,
    PRODUCT_READ_TOKEN: readToken,
  } = process.env;
  if (
    !number ||
    !/^\d+$/.test(number) ||
    !sha ||
    !product ||
    !runId ||
    !/^\d+$/.test(runId) ||
    !readToken
  )
    throw new Error('Missing exact auto-merge evidence');
  const pr = api(`pulls/${number}`);
  const files = api(`pulls/${number}/files?per_page=100`);
  const definition = assertTrustedLockPullRequest(pr, files, sha, product);
  const run = api(`actions/runs/${runId}`);
  assertRecord(run, 'CI run');
  assertRecord(run.repository, 'CI repository');
  if (
    run.repository.full_name !== repository ||
    run.name !== 'CI' ||
    run.path !== '.github/workflows/check.yml' ||
    run.event !== 'workflow_dispatch' ||
    run.head_branch !== `automation/data-product-${product}` ||
    run.head_sha !== sha ||
    run.status !== 'completed' ||
    run.conclusion !== 'success'
  )
    throw new Error('CI does not prove the exact protected PR head');
  const lock = parsePublicDataProductLock(
    JSON.parse(
      execFileSync('git', ['show', `${sha}:${definition.lockPath}`], {
        encoding: 'utf8',
        timeout: 10_000,
      }),
    ),
  );
  await readPublicDataProductRelease(
    { product, releaseTag: lock.releaseTag, identity: lock },
    createGitHubReleaseTransport(readToken),
  );
  // Preserve branch protection and any required gates beyond this workflow's own CI.
  gh(['pr', 'checks', number, '--repo', repository, '--required']);
  assertTrustedLockPullRequest(
    api(`pulls/${number}`),
    api(`pulls/${number}/files?per_page=100`),
    sha,
    product,
  );
  const result: unknown = JSON.parse(
    gh([
      'api',
      '--method',
      'PUT',
      `repos/${repository}/pulls/${number}/merge`,
      '-f',
      `sha=${sha}`,
      '-f',
      'merge_method=squash',
    ]),
  );
  assertRecord(result, 'merge response');
  if (
    result.merged !== true ||
    typeof result.sha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(result.sha)
  )
    throw new Error('Merge was not confirmed');
  // GITHUB_TOKEN merges suppress push workflows. Explicitly dispatch protected main CI;
  // Candidate verifies that run's main branch, exact SHA and success before any build.
  gh(['workflow', 'run', 'check.yml', '--repo', repository, '--ref', 'main']);
  console.log(`AUTO_MERGE=PASS sha=${result.sha}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Auto-merge failed');
    process.exitCode = 1;
  });
}
