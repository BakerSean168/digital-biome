import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function fixture(relative: string) {
  return readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');
}

const packageJson = JSON.parse(fixture('package.json')) as {
  scripts: Record<string, string>;
};
const ciWorkflow = fixture('.github/workflows/check.yml');
const candidateWorkflow = fixture('.github/workflows/candidate-publish.yml');
const releaseWorkflow = fixture('.github/workflows/release-publish.yml');
const productionWorkflow = fixture('.github/workflows/deploy-production.yml');

test('verification discovers nested edge and infrastructure tests', () => {
  assert.equal(packageJson.scripts['test:edge'], "tsx --test 'edge/**/*.test.ts'");
  assert.equal(packageJson.scripts['test:infrastructure'], "tsx --test 'scripts/**/*.test.ts'");
});

test('the required check workflow runs for every pull request to main', () => {
  const pullRequestBlock = ciWorkflow.match(/ {2}pull_request:\n[\s\S]*?(?=\n\nconcurrency:)/)?.[0];
  assert.ok(pullRequestBlock);
  assert.match(pullRequestBlock, /branches: \[main\]/);
  assert.doesNotMatch(pullRequestBlock, /paths:/);
  assert.match(ciWorkflow, / {2}workflow_dispatch:/);
});

test('main integration produces a candidate instead of deploying production', () => {
  assert.match(candidateWorkflow, /workflows: \['CI'\]/);
  assert.match(candidateWorkflow, /branches: \[main\]/);
  assert.match(candidateWorkflow, /Build immutable Pages candidate/);
  assert.match(candidateWorkflow, /pages functions build functions/);
  assert.match(candidateWorkflow, /digital-biome-pages\.tar\.gz/);
  assert.match(candidateWorkflow, /retention-days: 90/);
  assert.doesNotMatch(candidateWorkflow, /environment:\n {6}name: production/);
});

test('release publication promotes the exact candidate artifact without rebuilding', () => {
  assert.match(releaseWorkflow, /workflows: \['Publish Main Candidate'\]/);
  assert.match(releaseWorkflow, /Detect exact Release PR merge contract/);
  assert.match(
    releaseWorkflow,
    /Candidate is not a release-preparation merge; Release Publish is a safe no-op\./,
  );
  assert.match(releaseWorkflow, /digital-biome-pages\.tar\.gz/);
  assert.match(releaseWorkflow, /candidate_artifact_name/);
  assert.match(releaseWorkflow, /manifest\.ts provenance/);
  assert.doesNotMatch(releaseWorkflow, /pnpm build:only/);
  assert.doesNotMatch(releaseWorkflow, /pages functions build/);
});

test('production is manual Release selection and does not rebuild application code', () => {
  assert.match(productionWorkflow, /workflow_dispatch:/);
  assert.match(productionWorkflow, /release_tag:/);
  assert.doesNotMatch(productionWorkflow, /push:/);
  assert.match(productionWorkflow, /gh release download/);
  assert.match(productionWorkflow, /workingDirectory: release-package/);
  assert.match(productionWorkflow, /production requires an annotated Release provenance tag/);
  assert.match(productionWorkflow, /manifest\.ts provenance/);
  assert.match(productionWorkflow, /--no-bundle/);
  assert.doesNotMatch(productionWorkflow, /pnpm build:only/);
  assert.doesNotMatch(productionWorkflow, /pages functions build/);
});

test('production server telemetry does not require a Nezha PAT', () => {
  assert.doesNotMatch(productionWorkflow, /NEZHA_PAT/);
});

test('production validates the pinned Vault before private deployment inputs', () => {
  const step = productionWorkflow.match(
    / {6}- name: Revalidate pinned Vault and private source indexes\n[\s\S]*?(?=\n {6}- name: Validate production observability credentials)/,
  )?.[0];
  assert.ok(step, 'private source verification step must exist');

  const upstreamBuild = step.indexOf('pnpm build:upstream-indexes');
  const hashCheck = step.indexOf('actual_asset_index');
  const syncContent = step.indexOf('pnpm sync:content');
  const infrastructureTests = step.indexOf('pnpm test:infrastructure');

  assert.ok(upstreamBuild >= 0, 'deploy must rebuild the pinned upstream index');
  assert.ok(
    hashCheck > upstreamBuild,
    'deploy must verify the upstream asset hash after rebuilding it',
  );
  assert.ok(
    syncContent > hashCheck,
    'deploy must generate Digital Biome private inputs after hash verification',
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
  assert.match(ciWorkflow, /- 'biome\.json'/);
  assert.match(ciWorkflow, /- 'prettier\.config\.mjs'/);
  assert.match(ciWorkflow, /- '\.github\/workflows\/\*\*'/);
});
