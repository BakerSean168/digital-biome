import { assertRecord } from './lock-v1';

const repository = 'BakerSean168/digital-biome';

export type PRCheckState = 'approval-required' | 'running' | 'success';

/**
 * The required GitHub Actions check must be emitted by the actual pull_request
 * workflow. A successful workflow_dispatch job at the same SHA is NOT a
 * branch-protection check, even if GitHub shows it in the run history.
 */
export function assertTrustedPRCheckRun(
  value: unknown,
  prNumber: number,
  sha: string,
  product: string,
): PRCheckState {
  assertRecord(value, 'PR CI run');
  assertRecord(value.repository, 'PR CI repository');
  assertRecord(value.actor, 'PR CI actor');
  const refs = value.pull_requests;
  if (
    !Number.isSafeInteger(prNumber) ||
    prNumber <= 0 ||
    !/^[a-f0-9]{40}$/.test(sha) ||
    !Array.isArray(refs) ||
    !refs.some(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        item.number === prNumber &&
        item.head !== null &&
        typeof item.head === 'object' &&
        item.head.sha === sha &&
        item.base !== null &&
        typeof item.base === 'object' &&
        item.base.ref === 'main',
    ) ||
    value.repository.full_name !== repository ||
    value.name !== 'CI' ||
    value.path !== '.github/workflows/check.yml' ||
    value.event !== 'pull_request' ||
    value.actor.login !== 'github-actions[bot]' ||
    value.head_branch !== `automation/data-product-${product}` ||
    value.head_sha !== sha
  ) {
    throw new Error('CI is not the exact trusted pull_request workflow for this lock PR');
  }

  if (value.status === 'completed' && value.conclusion === 'action_required')
    return 'approval-required';
  if (value.status === 'completed' && value.conclusion === 'success') return 'success';
  if (
    (value.status === 'queued' ||
      value.status === 'in_progress' ||
      value.status === 'waiting' ||
      value.status === 'requested' ||
      value.status === 'pending') &&
    value.conclusion == null
  )
    return 'running';
  throw new Error('Required PR CI failed or reached an unsupported state');
}
