/** Build-time only. This module is never imported by browser code. */
import { execFileSync } from 'node:child_process';
import { version } from '../../package.json';

function git(args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}
const candidate =
  process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || git(['rev-parse', 'HEAD']);
const revision =
  candidate && /^[a-f0-9]{7,40}$/i.test(candidate) ? candidate.slice(0, 8) : 'unknown';
const status = git(['status', '--porcelain', '--untracked-files=normal']);
export const BUILD_INFO = {
  version,
  revision,
  state: status === undefined ? 'source unknown' : status ? 'worktree' : 'clean',
};
