import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertTrustedLockPullRequest } from '../delivery/content-policy';
import { assertTrustedPRCheckRun } from './pr-ci-evidence';

const repository = 'BakerSean168/digital-biome';

function gh(args: string[]) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 2 * 1024 * 1024,
  });
}

function api(route: string): unknown {
  return JSON.parse(gh(['api', `repos/${repository}/${route}`]));
}

function main() {
  // This is not a generic workflow-approval endpoint: it can approve only
  // this repository's bot-authored, one-file, fixed-branch lock updates.
  if (
    process.env.GITHUB_REPOSITORY !== repository ||
    process.env.GITHUB_REF !== 'refs/heads/main' ||
    ![
      `${repository}/.github/workflows/sync-data-products.yml@refs/heads/main`,
      `${repository}/.github/workflows/reconcile-data-products.yml@refs/heads/main`,
    ].includes(process.env.GITHUB_WORKFLOW_REF ?? '')
  )
    throw new Error('Untrusted PR CI approval workflow provenance');

  const { PR_NUMBER: number, HEAD_SHA: sha, PRODUCT: product, CI_RUN_ID: runId } = process.env;
  if (
    !number ||
    !/^[1-9]\d*$/.test(number) ||
    !sha ||
    !/^[a-f0-9]{40}$/.test(sha) ||
    !product ||
    !runId ||
    !/^[1-9]\d*$/.test(runId)
  )
    throw new Error('Missing exact PR CI approval evidence');

  const prNumber = Number(number);
  assertTrustedLockPullRequest(
    api(`pulls/${number}`),
    api(`pulls/${number}/files?per_page=100`),
    sha,
    product,
  );
  const state = assertTrustedPRCheckRun(api(`actions/runs/${runId}`), prNumber, sha, product);
  if (state === 'approval-required') {
    // Requires actions:write. If GitHub rejects approval, fail closed; never
    // reinterpret a workflow_dispatch success as a required status check.
    gh(['api', '--method', 'POST', `repos/${repository}/actions/runs/${runId}/approve`]);
    console.log(`PR_CI_APPROVAL=PASS run_id=${runId} sha=${sha}`);
  } else {
    console.log(`PR_CI_APPROVAL=NOT_NEEDED state=${state} run_id=${runId}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'PR CI approval failed');
    process.exitCode = 1;
  }
}
