import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import { classifyCILane } from './ci-lane';
import { pickActiveRun, type Run } from './content-continuation';
import { waitForApprovedCI } from '../data-products/approve-pr-ci';

const base = 'a'.repeat(40);
const tip = 'b'.repeat(40);
const head = 'c'.repeat(40);
const repository = { full_name: 'BakerSean168/digital-biome' };
const pr = {
  event: 'pull_request',
  ref: 'refs/pull/42/merge',
  head,
  parents: [base, tip],
  payload: {
    pull_request: {
      user: { login: 'github-actions[bot]' },
      changed_files: 1,
      draft: false,
      head: { sha: tip, ref: 'automation/data-product-knowledge-public-v1', repo: repository },
      base: { sha: base, ref: 'main', repo: repository },
    },
  },
};
test('trusted PR classification verifies actual merge parents and git diff', () => {
  const diff = (a: string, b: string) => a === base && b === head;
  assert.equal(classifyCILane(pr, diff), 'content');
  assert.equal(
    classifyCILane(pr, () => false),
    'application',
  );
  assert.equal(classifyCILane({ ...pr, parents: [base, head] }, diff), 'application');
  assert.equal(classifyCILane({ ...pr, parents: [tip, base] }, diff), 'application');
  for (const update of [
    { changed_files: 2 },
    { draft: true },
    { user: { login: 'someone' } },
    { head: { ...pr.payload.pull_request.head, ref: 'feature' } },
  ]) {
    assert.equal(
      classifyCILane(
        {
          ...pr,
          payload: { pull_request: { ...pr.payload.pull_request, ...update } },
        },
        diff,
      ),
      'application',
    );
  }
});

test('dispatch requires exact lock-only main; ordinary manual CI remains full', () => {
  const evidence = {
    event: 'workflow_dispatch',
    ref: 'refs/heads/main',
    head,
    parents: [base],
    payload: { inputs: { content_revision: head } },
  };
  assert.equal(
    classifyCILane(evidence, () => true),
    'content',
  );
  assert.throws(() => classifyCILane(evidence, () => false));
  assert.throws(() => classifyCILane({ ...evidence, head: tip }, () => true));
  assert.throws(() => classifyCILane({ ...evidence, ref: 'refs/heads/feature' }, () => true));
  assert.equal(
    classifyCILane({ ...evidence, payload: {} }, () => true),
    'application',
  );
  assert.equal(
    classifyCILane({ ...evidence, event: 'push', payload: { before: base } }, () => true),
    'content',
  );
  assert.equal(
    classifyCILane({ ...evidence, event: 'push', payload: { before: base } }, () => false),
    'application',
  );
});

test('PR approval tolerates stale approval status, approves once and fails closed on timeout', async () => {
  const states = [
    'running',
    'approval-required',
    'approval-required',
    'running',
    'success',
  ] as const;
  let i = 0;
  let approvals = 0;
  await waitForApprovedCI(
    () => states[i],
    async () => {
      i++;
    },
    () => i * 5_000,
    () => {
      approvals++;
    },
  );
  assert.equal(approvals, 1);
  let time = 0;
  await assert.rejects(
    waitForApprovedCI(
      () => 'approval-required',
      async () => {
        time += 30_000;
      },
      () => time,
      () => {},
    ),
    /did not propagate/,
  );
  await assert.rejects(
    waitForApprovedCI(
      () => {
        throw new Error('required check failed');
      },
      async () => {},
    ),
    /required check failed/,
  );
});

test('continuation ignores automatic skipped followers when selecting active dispatched runs', () => {
  const run: Run = {
    id: 1,
    head_sha: head,
    head_branch: 'main',
    event: 'workflow_run',
    status: 'queued',
    conclusion: null,
  };
  const dispatched = { ...run, id: 2, event: 'workflow_dispatch' };
  assert.equal(pickActiveRun('candidate-publish.yml', [run, dispatched])?.id, 2);
  assert.equal(pickActiveRun('deploy-content.yml', [run]), undefined);
  assert.equal(pickActiveRun('check.yml', [{ ...run, event: 'push' }])?.id, 1);
  assert.equal(pickActiveRun('check.yml', [{ ...run, status: 'completed' }]), undefined);
});

test('content CI materializes and builds only on main, Candidate reuses verified archive', () => {
  const workflow = (name: string) => parse(fs.readFileSync(`.github/workflows/${name}`, 'utf8'));
  const steps = workflow('check.yml').jobs.check.steps;
  const build = steps.find(
    (step: { name?: string }) => step.name === 'Build and check static content once on main',
  );
  assert.match(build.if, /lane == 'content'.*event_name != 'pull_request'/);
  const full = steps.find((step: { run?: string }) => step.run === 'pnpm verify:full');
  assert.match(full.if, /lane == 'application'/);
  const candidate = workflow('candidate-publish.yml').jobs['build-candidate'].steps;
  assert.match(
    candidate.find((step: { name?: string }) => step.name === 'Build exact-SHA public artifact').if,
    /content_build != '1'/,
  );
  assert.match(
    candidate.find(
      (step: { name?: string }) =>
        step.name === 'Verify and reuse the content build without rebuilding',
    ).run,
    /sha256sum --check/,
  );
  const continuation = workflow('content-continue.yml');
  assert.equal(continuation.permissions.actions, 'write');
  assert.equal(continuation.concurrency['cancel-in-progress'], false);
  assert.equal(continuation.jobs.continue.if, "github.ref == 'refs/heads/main'");
});
