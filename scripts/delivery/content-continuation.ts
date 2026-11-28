import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyContentChange } from './content-policy';

const repository = 'BakerSean168/digital-biome';
const shaPattern = /^[a-f0-9]{40}$/;

function gh(args: string[]) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
}
function api<T>(route: string): T {
  return JSON.parse(gh(['api', `repos/${repository}/${route}`]));
}
function mainSha() {
  const { object } = api<{ object: { sha: string } }>('git/ref/heads/main');
  if (!shaPattern.test(object.sha)) throw new Error('Invalid main revision');
  return object.sha;
}
function isContentRevision(sha: string) {
  const commit = api<{ sha: string; parents: { sha: string }[] }>(`commits/${sha}`);
  if (commit.sha !== sha || commit.parents.length !== 1) return false;
  const comparison = api<{
    total_commits: number;
    files: Parameters<typeof classifyContentChange>[0];
  }>(`compare/${commit.parents[0].sha}...${sha}`);
  return comparison.total_commits === 1 && classifyContentChange(comparison.files);
}
export type Stage = 'check.yml' | 'candidate-publish.yml' | 'deploy-content.yml';
export type Run = {
  id: number;
  head_sha: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
};
export function pickActiveRun(stage: Stage, candidates: Run[]) {
  // Automatic workflow_run followers of a bot-dispatched job are deliberately
  // skipped. Do not attach recovery to a pending skipped follower.
  return candidates.find(
    (run) =>
      run.status !== 'completed' && (stage === 'check.yml' || run.event === 'workflow_dispatch'),
  );
}
function runs(stage: Stage, sha: string) {
  return api<{ workflow_runs: Run[] }>(
    `actions/workflows/${stage}/runs?branch=main&head_sha=${sha}&per_page=100`,
  ).workflow_runs.filter(
    (run) =>
      run.head_sha === sha &&
      run.head_branch === 'main' &&
      ['push', 'workflow_dispatch', 'workflow_run'].includes(run.event),
  );
}
function hasCandidate(run: Run, sha: string) {
  const artifacts = api<{ artifacts: { name: string; expired: boolean }[] }>(
    `actions/runs/${run.id}/artifacts?per_page=100`,
  ).artifacts;
  return artifacts.filter((a) => a.name === `candidate-${sha}` && !a.expired).length === 1;
}
function hasPromotion(run: Run) {
  const jobs = api<{ jobs: { steps?: { name: string; conclusion: string }[] }[] }>(
    `actions/runs/${run.id}/jobs?per_page=100`,
  ).jobs;
  return jobs.some((job) =>
    job.steps?.some(
      (step) =>
        step.name === 'Promote the verified content artifact without rebuilding' &&
        step.conclusion === 'success',
    ),
  );
}
function dispatch(stage: Stage | 'content-continue.yml', fields: Record<string, string>) {
  const args = ['workflow', 'run', stage, '--repo', repository, '--ref', 'main'];
  for (const [key, value] of Object.entries(fields)) args.push('-f', `${key}=${value}`);
  gh(args);
}

async function ensureRun(
  stage: Stage,
  sha: string,
  fields: Record<string, string>,
  verified: (run: Run) => boolean = () => true,
): Promise<Run | undefined> {
  // Explicit dispatch avoids the workflow_run three-level limit and bot-token
  // event suppression. Reuse completed/active exact-revision runs on recovery.
  const previous = runs(stage, sha);
  const success = previous.find((run) => run.conclusion === 'success' && verified(run));
  if (success) {
    console.log(`REUSE ${stage} run=${success.id} sha=${sha}`);
    return success;
  }
  if (mainSha() !== sha) return;
  const active = pickActiveRun(stage, previous);
  const oldIds = new Set(previous.map((run) => run.id));
  if (!active) dispatch(stage, fields);
  const deadline = Date.now() + 20 * 60_000;
  while (Date.now() < deadline) {
    if (mainSha() !== sha) {
      console.log(`SUPERSEDED sha=${sha}`);
      return;
    }
    const run = runs(stage, sha).find((r) =>
      active ? r.id === active.id : !oldIds.has(r.id) && r.event === 'workflow_dispatch',
    );
    if (run?.status === 'completed') {
      if (run.conclusion !== 'success')
        throw new Error(`${stage} run=${run.id} ended ${run.conclusion}`);
      if (!verified(run)) {
        if (stage === 'deploy-content.yml') {
          console.log(
            `CONTENT_PROMOTION_NOT_PERFORMED run=${run.id}; inspect policy/production baseline`,
          );
          return;
        }
        throw new Error(`Missing verified artifact: ${stage} run=${run.id}`);
      }
      console.log(`PASS ${stage} run=${run.id} sha=${sha}`);
      return run;
    }
    await sleep(10_000);
  }
  throw new Error(`Timed out waiting for exact-revision ${stage}; reconciliation can resume`);
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== repository || process.env.GITHUB_REF !== 'refs/heads/main')
    throw new Error('Untrusted content continuation ref');
  const mode = process.argv[2];
  const sha = mainSha();
  if (mode === 'queue') {
    if (!isContentRevision(sha)) {
      console.log('NO_CONTENT_REVISION');
      return;
    }
    if (
      runs('deploy-content.yml', sha).some(
        (run) => run.conclusion === 'success' && hasPromotion(run),
      )
    ) {
      console.log(`CONTENT_ALREADY_PROMOTED sha=${sha}`);
      return;
    }
    // Both producer products share one continuation lane. Its concurrency
    // group and exact-main checks serialize/recover repeated dispatches.
    dispatch('content-continue.yml', { revision: sha });
    console.log(`QUEUED_CONTENT_CONTINUATION sha=${sha}`);
    return;
  }
  if (mode !== 'continue' || !shaPattern.test(process.env.CONTENT_REVISION ?? ''))
    throw new Error('Invalid continuation request');
  if (sha !== process.env.CONTENT_REVISION || !isContentRevision(sha)) {
    console.log('CONTENT_REVISION_SUPERSEDED_OR_NOT_ELIGIBLE');
    return;
  }
  if (
    runs('deploy-content.yml', sha).some((run) => run.conclusion === 'success' && hasPromotion(run))
  ) {
    console.log(`CONTENT_ALREADY_PROMOTED sha=${sha}`);
    return;
  }
  const ci = await ensureRun('check.yml', sha, { content_revision: sha });
  if (!ci) return;
  const candidate = await ensureRun(
    'candidate-publish.yml',
    sha,
    { ci_run_id: String(ci.id) },
    (run) => hasCandidate(run, sha),
  );
  if (!candidate) return;
  if (process.env.CONTENT_AUTO_DEPLOY_ENABLED !== 'true') {
    console.log('CONTENT_AUTO_DEPLOY=DISABLED; verified Candidate retained');
    return;
  }
  await ensureRun(
    'deploy-content.yml',
    sha,
    { candidate_run_id: String(candidate.id) },
    hasPromotion,
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Content continuation failed');
    process.exitCode = 1;
  });
}
