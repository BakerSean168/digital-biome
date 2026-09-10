import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as {
  scripts: Record<string, string>;
};
const workflow = readFileSync(
  fileURLToPath(new URL('../.github/workflows/check.yml', import.meta.url)),
  'utf8',
);
const deployWorkflow = readFileSync(
  fileURLToPath(new URL('../.github/workflows/deploy-cloudflare-pages.yml', import.meta.url)),
  'utf8',
);

test('verification discovers nested edge and infrastructure tests', () => {
  assert.equal(packageJson.scripts['test:edge'], "tsx --test 'edge/**/*.test.ts'");
  assert.equal(packageJson.scripts['test:infrastructure'], "tsx --test 'scripts/**/*.test.ts'");
});

test('the required check workflow runs for every pull request to main', () => {
  const pullRequestBlock = workflow.match(/ {2}pull_request:\n[\s\S]*?(?=\n\nconcurrency:)/)?.[0];
  assert.ok(pullRequestBlock);
  assert.match(pullRequestBlock, /branches: \[main\]/);
  assert.doesNotMatch(pullRequestBlock, /paths:/);
});

test('production server telemetry does not require a Nezha PAT', () => {
  assert.doesNotMatch(deployWorkflow, /NEZHA_PAT/);
});

test('production deploy rebuilds Digital Biome indexes before infrastructure contracts', () => {
  const step = deployWorkflow.match(
    / {6}- name: Rebuild and verify private source index\n[\s\S]*?(?=\n {6}- name: Validate production observability credentials)/,
  )?.[0];
  assert.ok(step, 'private source verification step must exist');

  const upstreamBuild = step.indexOf('pnpm build:upstream-indexes');
  const hashCheck = step.indexOf(
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal shell variables asserted in workflow source.
    'test "${ACTUAL_ASSET_INDEX_SHA256}" = "${EXPECTED_ASSET_INDEX_SHA256}"',
  );
  const syncContent = step.indexOf('pnpm sync:content');
  const infrastructureTests = step.indexOf('pnpm test:infrastructure');

  assert.ok(upstreamBuild >= 0, 'deploy must rebuild the pinned upstream index');
  assert.ok(
    hashCheck > upstreamBuild,
    'deploy must verify the upstream asset hash before local sync',
  );
  assert.ok(
    syncContent > hashCheck,
    'deploy must generate Digital Biome indexes after the pinned hash check',
  );
  assert.ok(
    infrastructureTests > syncContent,
    'infrastructure contracts must run after generated indexes exist',
  );
});

test('quality gates are part of the canonical verify contract', () => {
  assert.equal(
    packageJson.scripts.lint,
    'biome lint --diagnostic-level=warn --error-on-warnings .',
  );
  assert.equal(packageJson.scripts['format:check'], 'tsx scripts/check-format-ratchet.ts');
  assert.equal(packageJson.scripts.quality, 'pnpm lint && pnpm format:check');
  assert.match(packageJson.scripts.verify, /^pnpm quality && /);
  assert.match(workflow, /- 'biome\.json'/);
  assert.match(workflow, /- 'prettier\.config\.mjs'/);
  assert.match(workflow, /- '\.github\/workflows\/\*\*'/);
});
