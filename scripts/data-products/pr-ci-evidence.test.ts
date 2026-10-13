import assert from 'node:assert/strict';
import test from 'node:test';
import { assertTrustedPRCheckRun } from './pr-ci-evidence';

const sha = 'a'.repeat(40);
const prNumber = 147;
const product = 'knowledge-public-v1';
const run = {
  repository: { full_name: 'BakerSean168/digital-biome' },
  actor: { login: 'github-actions[bot]' },
  name: 'CI',
  path: '.github/workflows/check.yml',
  event: 'pull_request',
  head_branch: 'automation/data-product-knowledge-public-v1',
  head_sha: sha,
  pull_requests: [{ number: prNumber, head: { sha }, base: { ref: 'main' } }],
  status: 'completed',
  conclusion: 'action_required',
};

test('an exact bot-created PR check can be approved without pretending a dispatched run is required CI', () => {
  assert.equal(assertTrustedPRCheckRun(run, prNumber, sha, product), 'approval-required');
  assert.equal(
    assertTrustedPRCheckRun(
      { ...run, status: 'in_progress', conclusion: null },
      prNumber,
      sha,
      product,
    ),
    'running',
  );
  assert.equal(
    assertTrustedPRCheckRun({ ...run, conclusion: 'success' }, prNumber, sha, product),
    'success',
  );
});

test('PR approval is fail-closed on unrelated event, head, branch, number, author or workflow', () => {
  const changed = [
    { event: 'workflow_dispatch' },
    { event: 'push' },
    { repository: { full_name: 'outsider/digital-biome' } },
    { actor: { login: 'attacker' } },
    { head_sha: 'b'.repeat(40) },
    { head_branch: 'arbitrary-branch' },
    { name: 'not-CI' },
    { path: '.github/workflows/deploy-production.yml' },
    { pull_requests: [] },
    { pull_requests: [{ number: 999, head: { sha }, base: { ref: 'main' } }] },
    { pull_requests: [{ number: prNumber, head: { sha: 'b'.repeat(40) }, base: { ref: 'main' } }] },
    { pull_requests: [{ number: prNumber, head: { sha }, base: { ref: 'other' } }] },
    { conclusion: 'failure' },
    { conclusion: 'cancelled' },
    { status: 'completed', conclusion: null },
  ];
  for (const update of changed)
    assert.throws(
      () => assertTrustedPRCheckRun({ ...run, ...update }, prNumber, sha, product),
      JSON.stringify(update),
    );
  assert.throws(() => assertTrustedPRCheckRun(run, 0, sha, product));
  assert.throws(() => assertTrustedPRCheckRun(run, prNumber, 'not a SHA', product));
  assert.throws(() => assertTrustedPRCheckRun(run, prNumber, sha, 'infra-public-v2'));
});
