import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
const releasePleaseWorkflow = fixture('.github/workflows/release-please.yml');
const releaseWorkflow = fixture('.github/workflows/release-publish.yml');
const productionWorkflow = fixture('.github/workflows/deploy-production.yml');
const knowledgeSyncWorkflow = fixture('.github/workflows/sync-knowledge-public-v1.yml');

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

test('main integration builds from the immutable knowledge projection instead of the private gitlink', () => {
  assert.match(ciWorkflow, /Fetch and materialize pinned knowledge-public-v1/);
  assert.match(ciWorkflow, /prepare-knowledge-public-v1\.sh/);
  assert.doesNotMatch(ciWorkflow, /submodules: recursive/);

  assert.match(candidateWorkflow, /workflows: \['CI'\]/);
  assert.match(candidateWorkflow, /branches: \[main\]/);
  assert.match(candidateWorkflow, /Build immutable Pages candidate/);
  assert.match(candidateWorkflow, /Fetch and materialize pinned knowledge-public-v1/);
  assert.match(candidateWorkflow, /knowledgeArtifactSha256/);
  assert.match(candidateWorkflow, /digital-biome-private-infrastructure-v1\.lock\.json/);
  assert.match(candidateWorkflow, /privateInfrastructure:/);
  assert.doesNotMatch(candidateWorkflow, /submodules: recursive/);
  assert.match(candidateWorkflow, /pages functions build functions/);
  assert.match(candidateWorkflow, /--outdir "\$worker_dir"/);
  assert.match(candidateWorkflow, /node --check "\$worker_dir\/index\.js"/);
  assert.match(candidateWorkflow, /install -m 0644 "\$worker_dir\/index\.js" dist\/_worker\.js/);
  assert.doesNotMatch(candidateWorkflow, /--outfile dist\/_worker\.js/);
  assert.match(candidateWorkflow, /digital-biome-pages\.tar\.gz/);
  assert.match(candidateWorkflow, /retention-days: 90/);
  assert.doesNotMatch(candidateWorkflow, /environment:\n {6}name: production/);
});

test('producer publication updates only the immutable consumer lock through a protected PR', () => {
  assert.match(knowledgeSyncWorkflow, /knowledge-public-v1-published/);
  assert.match(knowledgeSyncWorkflow, /automation\/knowledge-public-v1-sync/);
  assert.match(knowledgeSyncWorkflow, /actions: write/);
  assert.match(knowledgeSyncWorkflow, /artifact_sha256/);
  assert.match(knowledgeSyncWorkflow, /manifest_sha256/);
  assert.match(knowledgeSyncWorkflow, /gh release download/);
  assert.match(knowledgeSyncWorkflow, /git add data-products\/knowledge-public-v1\.lock\.json/);
  assert.doesNotMatch(knowledgeSyncWorkflow, /git ls-tree HEAD thought-forest/);
  assert.doesNotMatch(knowledgeSyncWorkflow, /git submodule/);
  assert.match(knowledgeSyncWorkflow, /gh pr create/);
  assert.match(knowledgeSyncWorkflow, /actions\/runs\/\$run_id\/approve/);
  assert.match(knowledgeSyncWorkflow, /gh run watch "\$run_id"/);
});

test('Digital Biome no longer carries a Thought Forest gitlink', () => {
  const gitmodules = fileURLToPath(new URL('../.gitmodules', import.meta.url));
  assert.equal(existsSync(gitmodules), false);
  assert.equal('build:upstream-indexes' in packageJson.scripts, false);
  assert.equal('pull-notes' in packageJson.scripts, false);
  assert.equal('dev:pull' in packageJson.scripts, false);
});

test('release preparation approves and waits for protected Release PR CI', () => {
  assert.match(releasePleaseWorkflow, /workflow_dispatch:/);
  assert.match(releasePleaseWorkflow, /--event pull_request/);
  assert.match(releasePleaseWorkflow, /actions\/runs\/\$run_id\/approve/);
  assert.match(
    releasePleaseWorkflow,
    /gh run watch "\$run_id" --repo "\$GITHUB_REPOSITORY" --exit-status/,
  );
  assert.doesNotMatch(releasePleaseWorkflow, /gh workflow run check\.yml/);
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

  const checkoutIndex = releaseWorkflow.indexOf('- name: Checkout exact Candidate source');
  const downloadIndex = releaseWorkflow.indexOf('- name: Download exact Candidate identity');
  assert.ok(checkoutIndex >= 0, 'release resolver must checkout the exact Candidate source');
  assert.ok(
    downloadIndex > checkoutIndex,
    'Candidate artifact must be downloaded after checkout so checkout cleanup cannot delete it',
  );

  assert.doesNotMatch(releaseWorkflow, /pnpm build:only/);
  assert.doesNotMatch(releaseWorkflow, /pages functions build/);
  assert.match(releaseWorkflow, /issues: write/);
  assert.match(releaseWorkflow, /Finalize release-please PR state/);
  assert.match(releaseWorkflow, /commits\/\$RELEASE_SHA\/pulls/);
  assert.match(releaseWorkflow, /issues\/\$release_pr\/labels\/autorelease%3A%20pending/);
  assert.match(
    releaseWorkflow,
    /issues\/\$release_pr\/labels["']?[\s\S]*labels\[\]=autorelease: tagged/,
  );
  assert.doesNotMatch(releaseWorkflow, /gh pr edit/);
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

test('production v3 consumes the pinned Personal Infrastructure runtime binding', () => {
  const step = productionWorkflow.match(
    / {6}- name: Revalidate knowledge projection and private deployment source\n[\s\S]*?(?=\n {6}- name: Validate production observability credentials)/,
  )?.[0];
  assert.ok(step, 'knowledge/private source verification step must exist');

  assert.match(
    productionWorkflow,
    /repository: BakerSean168\/personal-infrastructure[\s\S]*ssh-key: \$\{\{ secrets\.PERSONAL_INFRASTRUCTURE_DEPLOY_KEY \}\}[\s\S]*path: \.pds-runtime\/personal-infrastructure/,
  );
  assert.match(step, /digital-biome\.release\/v3/);
  assert.match(step, /digital-biome-private-infrastructure-v1\.lock\.json/);
  assert.match(step, /Personal Infrastructure runtime binding digest mismatch/);
  assert.match(step, /PDS_PRIVATE_INFRASTRUCTURE_BINDING/);
  assert.match(step, /private-infrastructure-binding\.test\.ts/);

  const v3Block = step.match(
    /digital-biome\.release\/v3\)[\s\S]*?(?=\n {12}digital-biome\.release\/v2\))/,
  )?.[0];
  assert.ok(v3Block, 'v3 private runtime binding branch must exist');
  assert.match(v3Block, /prepare-knowledge-public-v1\.sh/);
  assert.match(v3Block, /public_root=\.pds-runtime\/knowledge-public-v1\/source/);
  assert.match(v3Block, /NOTES_UPSTREAM_GENERATED=\$public_root\/generated/);
  assert.doesNotMatch(v3Block, /kb:index/);
  assert.doesNotMatch(v3Block, /pnpm sync:content/);
  assert.doesNotMatch(v3Block, /private-thought-forest/);

  assert.match(
    productionWorkflow,
    /digital-biome\.release\/v2[\s\S]*repository: BakerSean168\/thought-forest[\s\S]*path: \.pds-runtime\/private-thought-forest/,
  );
  assert.match(step, /digital-biome\.release\/v1[\s\S]*actual_asset_index/);

  const bindingStep = productionWorkflow.match(
    / {6}- name: Generate and update encrypted Pages bindings\n[\s\S]*?(?=\n {6}- name: Verify and unpack immutable Pages artifact)/,
  )?.[0];
  assert.ok(bindingStep, 'encrypted binding step must exist');
  assert.match(bindingStep, /--contract "\$PDS_PRIVATE_INFRASTRUCTURE_BINDING"/);
  assert.match(
    bindingStep,
    /digital-biome\.release\/v2\|digital-biome\.release\/v1\)[\s\S]*pnpm export:private:legacy/,
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
