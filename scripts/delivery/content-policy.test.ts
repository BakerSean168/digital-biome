import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyContentChange, assertTrustedLockPullRequest } from './content-policy';
const lock = 'data-products/knowledge-public-v1.lock.json';
const file = { filename: lock, status: 'modified' };
const pr = {
  state: 'open',
  draft: false,
  changed_files: 1,
  user: { login: 'github-actions[bot]' },
  head: {
    sha: 'a'.repeat(40),
    ref: 'automation/data-product-knowledge-public-v1',
    repo: { full_name: 'BakerSean168/digital-biome' },
  },
  base: { ref: 'main', repo: { full_name: 'BakerSean168/digital-biome' } },
};
test('only nonempty public lock modifications are content changes', () => {
  assert.equal(classifyContentChange([file]), true);
  assert.equal(
    classifyContentChange([{ ...file, filename: 'data-products/pds-catalog-v1.lock.json' }, file]),
    true,
  );
  for (const files of [
    [],
    [{ ...file, status: 'removed' }],
    [{ ...file, status: 'renamed' }],
    [file, { filename: 'README.md', status: 'modified' }],
    [
      {
        filename: 'data-products/digital-biome-private-infrastructure-v1.lock.json',
        status: 'modified',
      },
    ],
    [{ filename: 'src/data/system/pds-catalog-v1.json', status: 'modified' }],
    [{ filename: '.github/workflows/check.yml', status: 'modified' }],
    [file, file],
  ])
    assert.equal(classifyContentChange(files), false);
});
test('auto-merge additionally requires the exact same-repository bot branch and complete file evidence', () => {
  assertTrustedLockPullRequest(pr, [file], 'a'.repeat(40), 'knowledge-public-v1');
  for (const change of [
    { user: { login: 'other' } },
    { draft: true },
    { changed_files: 2 },
    { state: 'closed' },
    { head: { ...pr.head, sha: 'b'.repeat(40) } },
    { head: { ...pr.head, ref: 'feature/knowledge-public-v1' } },
    { head: { ...pr.head, repo: { full_name: 'attacker/digital-biome' } } },
    { base: { ...pr.base, ref: 'other' } },
  ]) {
    assert.throws(() =>
      assertTrustedLockPullRequest(
        { ...pr, ...change },
        [file],
        'a'.repeat(40),
        'knowledge-public-v1',
      ),
    );
  }
  assert.throws(() =>
    assertTrustedLockPullRequest(
      pr,
      [file, { filename: 'README.md', status: 'modified' }],
      'a'.repeat(40),
      'knowledge-public-v1',
    ),
  );
  assert.throws(() => assertTrustedLockPullRequest(pr, [file], 'a'.repeat(40), 'pds-catalog-v1'));
});

test('production classification compares the deployed base as well as the last commit', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { classifyGitContentChange } = await import('./content-policy');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-history-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  try {
    git('init', '-q');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.com');
    fs.mkdirSync(path.join(root, 'data-products'));
    fs.writeFileSync(path.join(root, lock), 'one');
    git('add', '.');
    git('commit', '-qm', 'baseline');
    const deployed = git('rev-parse', 'HEAD');
    fs.writeFileSync(path.join(root, 'app.ts'), 'unreleased app');
    git('add', '.');
    git('commit', '-qm', 'application');
    const app = git('rev-parse', 'HEAD');
    fs.writeFileSync(path.join(root, lock), 'two');
    git('add', '.');
    git('commit', '-qm', 'data');
    const candidate = git('rev-parse', 'HEAD');
    assert.equal(classifyGitContentChange(root, app, candidate), true);
    assert.equal(classifyGitContentChange(root, deployed, candidate), false);
    assert.equal(classifyGitContentChange(root, candidate, deployed), false);
    assert.equal(classifyGitContentChange(root, candidate, candidate), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('automatic lanes keep kill switches, separate production environment and immutable deployment', async () => {
  const fs = await import('node:fs');
  const { parse } = await import('yaml');
  const content = parse(fs.readFileSync('.github/workflows/deploy-content.yml', 'utf8'));
  assert.match(content.jobs.resolve.if, /CONTENT_AUTO_DEPLOY_ENABLED/);
  assert.equal(content.jobs.deploy.environment.name, 'production-content');
  assert.equal(content.concurrency.group, 'production-release-selection');
  const steps = content.jobs.deploy.steps;
  const deploy = steps.find((s: { id?: string }) => s.id === 'deploy');
  assert.match(deploy.with.command, /--no-bundle/);
  assert.match(deploy.if, /freshness.outputs.eligible/);
  const commands = steps.map((s: { run?: string }) => s.run ?? '').join('\n');
  assert.doesNotMatch(commands, /astro build|pnpm build|pages secret put|gh release create/);
  assert.match(commands, /revalidate.ts/);
  assert.match(commands, /content-candidate.ts baseline/);
  const sync = parse(fs.readFileSync('.github/workflows/sync-data-products.yml', 'utf8'));
  const merge = sync.jobs.sync.steps.find((s: { run?: string }) =>
    s.run?.includes('auto-merge.ts'),
  );
  assert.match(merge.if, /DATA_PRODUCT_AUTO_MERGE_ENABLED/);
  assert.equal(merge.env.HEAD_SHA, `\${{ steps.pr.outputs.head_sha }}`);
  assert.equal(merge.env.CI_RUN_ID, `\${{ steps.ci.outputs.run_id }}`);
});
