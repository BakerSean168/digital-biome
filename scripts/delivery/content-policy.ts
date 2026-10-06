import { execFileSync, spawnSync } from 'node:child_process';
import { assertRecord } from '../data-products/lock-v1';
import { publicDataProducts } from '../data-products/registry';

const repository = 'BakerSean168/digital-biome';

export function classifyContentChange(files: unknown): boolean {
  if (!Array.isArray(files) || !files.length || files.length > publicDataProducts.length)
    return false;
  const seen = new Set<string>();
  for (const file of files) {
    if (!file || typeof file !== 'object' || Array.isArray(file)) return false;
    if (
      file.status !== 'modified' ||
      !publicDataProducts.some((p) => p.lockPath === file.filename) ||
      seen.has(file.filename)
    )
      return false;
    seen.add(file.filename);
  }
  return true;
}

/** This classifier is necessary but not sufficient: caller must also verify live Release + exact CI. */
export function assertTrustedLockPullRequest(
  value: unknown,
  files: unknown,
  sha: string,
  product: string,
) {
  assertRecord(value, 'PR');
  assertRecord(value.user, 'PR author');
  assertRecord(value.head, 'PR head');
  assertRecord(value.head.repo, 'PR head repository');
  assertRecord(value.base, 'PR base');
  assertRecord(value.base.repo, 'PR base repository');
  const definition = publicDataProducts.find((p) => p.product === product);
  if (
    !definition ||
    !/^[a-f0-9]{40}$/.test(sha) ||
    value.state !== 'open' ||
    value.draft !== false ||
    value.user.login !== 'github-actions[bot]' ||
    value.head.sha !== sha ||
    value.head.ref !== `automation/data-product-${product}` ||
    value.head.repo.full_name !== repository ||
    value.base.repo.full_name !== repository ||
    value.base.ref !== 'main' ||
    value.changed_files !== 1 ||
    !classifyContentChange(files) ||
    !Array.isArray(files) ||
    files.length !== 1 ||
    files[0].filename !== definition.lockPath
  )
    throw new Error('PR is not a trusted exact-head lock-only change');
  return definition;
}

export function classifyGitContentChange(root: string, base: string, head: string): boolean {
  if (![base, head].every((value) => /^[a-f0-9]{40}$/.test(value)))
    throw new Error('Content comparison requires full Git SHAs');
  if (base === head) return false;
  const ancestry = spawnSync('git', ['-C', root, 'merge-base', '--is-ancestor', base, head], {
    timeout: 10_000,
  });
  if (ancestry.status === 1) return false;
  if (ancestry.status !== 0) throw new Error('Cannot establish production ancestry');
  const raw = execFileSync(
    'git',
    ['-C', root, 'diff', '--name-status', '--no-renames', '-z', base, head],
    { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024 },
  );
  const parts = raw.split('\0');
  if (parts.pop() !== '' || parts.length % 2) throw new Error('Invalid Git changed-file evidence');
  const files = [];
  for (let index = 0; index < parts.length; index += 2)
    files.push({
      filename: parts[index + 1],
      status: parts[index] === 'M' ? 'modified' : parts[index],
    });
  return classifyContentChange(files);
}
