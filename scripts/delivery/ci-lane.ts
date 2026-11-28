import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { classifyGitContentChange } from './content-policy';
import { publicDataProducts } from '../data-products/registry';

const repository = 'BakerSean168/digital-biome';
type Lane = 'application' | 'content';
type Evidence = {
  event: string;
  payload: {
    before?: string;
    inputs?: { content_revision?: string };
    pull_request?: {
      user?: { login?: string };
      changed_files?: number;
      draft?: boolean;
      head?: { sha?: string; ref?: string; repo?: { full_name?: string } };
      base?: { sha?: string; ref?: string; repo?: { full_name?: string } };
    };
  };
  head: string;
  parents: string[];
  ref: string;
};

export function classifyCILane(
  evidence: Evidence,
  compare: (base: string, head: string) => boolean,
): Lane {
  const { event, payload, head, parents, ref } = evidence;
  if (event === 'pull_request') {
    const pr = payload.pull_request;
    if (
      pr?.user?.login !== 'github-actions[bot]' ||
      pr.draft !== false ||
      pr.changed_files !== 1 ||
      pr.head?.repo?.full_name !== repository ||
      pr.base?.repo?.full_name !== repository ||
      pr.base?.ref !== 'main' ||
      !publicDataProducts.some((p) => pr.head?.ref === `automation/data-product-${p.product}`) ||
      parents.length !== 2 ||
      parents[0] !== pr.base?.sha ||
      parents[1] !== pr.head?.sha
    )
      return 'application';
    return compare(parents[0], head) ? 'content' : 'application';
  }
  if (event === 'workflow_dispatch' && payload.inputs?.content_revision) {
    if (
      ref !== 'refs/heads/main' ||
      payload.inputs.content_revision !== head ||
      parents.length !== 1 ||
      !compare(parents[0], head)
    )
      throw new Error('Explicit content CI requires the exact main lock-only revision');
    return 'content';
  }
  if (
    event === 'push' &&
    ref === 'refs/heads/main' &&
    /^[a-f0-9]{40}$/.test(payload.before ?? '')
  ) {
    const before = payload.before ?? '';
    if (before !== '0'.repeat(40) && compare(before, head)) return 'content';
  }
  return 'application';
}

function git(args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8', timeout: 15_000 }).trim();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [head, ...parents] = git(['rev-list', '--parents', '-n', '1', 'HEAD']).split(' ');
  const lane = classifyCILane(
    {
      event: process.env.GITHUB_EVENT_NAME ?? '',
      payload: JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8')),
      head,
      parents,
      ref: process.env.GITHUB_REF ?? '',
    },
    (base, revision) => classifyGitContentChange(process.cwd(), base, revision),
  );
  fs.appendFileSync(process.env.GITHUB_OUTPUT ?? '', `lane=${lane}\n`);
  console.log(`CI_LANE=${lane}`);
}
