import { parse } from 'yaml';
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

test('verification discovers nested edge and infrastructure tests', () => {
  assert.equal(packageJson.scripts['test:edge'], "tsx --test 'edge/**/*.test.ts'");
  assert.equal(packageJson.scripts['test:infrastructure'], "tsx --test 'scripts/**/*.test.ts'");
});

test('retired infra-public-v1 consumer code is not part of the current application', () => {
  for (const relative of [
    './data-products/infra-public-v1.ts',
    './data-products/infra-public-v1.test.ts',
    './data-products/sync-infra-public-v1.ts',
  ]) {
    assert.equal(
      existsSync(fileURLToPath(new URL(relative, import.meta.url))),
      false,
      `${relative} should remain retired`,
    );
  }
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /infra-public-v1/);
});

test('retired twin-public-v1 consumer code is not part of the current application', () => {
  for (const relative of [
    './data-products/twin-public-v1.ts',
    './data-products/twin-public-v1.test.ts',
    './data-products/sync-twin-public-v1.ts',
  ]) {
    assert.equal(
      existsSync(fileURLToPath(new URL(relative, import.meta.url))),
      false,
      `${relative} should remain retired`,
    );
  }
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /twin-public-v1/);
});

test('the required check workflow runs for every pull request to main', () => {
  const pullRequestBlock = ciWorkflow.match(/ {2}pull_request:\n[\s\S]*?(?=\n\nconcurrency:)/)?.[0];
  assert.ok(pullRequestBlock);
  assert.match(pullRequestBlock, /branches: \[main\]/);
  assert.doesNotMatch(pullRequestBlock, /paths:/);
  assert.match(ciWorkflow, / {2}workflow_dispatch:/);
});

test('main integration builds all immutable public products through one preparation entrypoint', () => {
  assert.match(ciWorkflow, /Fetch and materialize all pinned public data products/);
  assert.match(ciWorkflow, /pnpm sync:data-products/);
  assert.equal(packageJson.scripts.sync, 'pnpm sync:data-products');
  assert.equal(
    packageJson.scripts['sync:data-products'],
    'tsx scripts/data-products/prepare-all.ts',
  );
  assert.doesNotMatch(
    ciWorkflow,
    /producer-root|personal-infrastructure-public|PDS_INFRA_PUBLIC_DEPLOY_KEY/,
  );
  assert.doesNotMatch(ciWorkflow, /submodules: recursive/);

  assert.match(candidateWorkflow, /workflows: \['CI'\]/);
  assert.match(candidateWorkflow, /branches: \[main\]/);
  assert.match(candidateWorkflow, /Build immutable Pages candidate/);
  assert.match(candidateWorkflow, /Fetch and materialize all pinned public data products/);
  assert.match(candidateWorkflow, /ssh-key: \$\{\{ secrets\.PDS_INFRA_PUBLIC_DEPLOY_KEY \}\}/);
  assert.match(candidateWorkflow, /pnpm sync:data-products/);
  assert.doesNotMatch(candidateWorkflow, /producer-root|personal-infrastructure-public/);
  assert.match(candidateWorkflow, /knowledge-public-v1\.lock\.json/);
  assert.match(candidateWorkflow, /infra-public-v2\.lock\.json/);
  assert.match(candidateWorkflow, /dataProducts:/);
  assert.match(candidateWorkflow, /digital-biome-private-infrastructure-v1\.lock\.json/);
  assert.match(candidateWorkflow, /privateBindings:/);
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

test('staging promotion refreshes the exact pinned private RuntimeBinding before deployment', () => {
  const stagingBlock = candidateWorkflow.match(
    / {2}deploy-staging:[\s\S]*?(?=\n {2}[a-zA-Z0-9_-]+:|$)/,
  )?.[0];
  assert.ok(stagingBlock, 'staging promotion job must exist');
  assert.match(stagingBlock, /Resolve pinned private infrastructure binding/);
  assert.match(stagingBlock, /digital-biome-private-infrastructure-v1\.lock\.json/);
  assert.match(stagingBlock, /Checkout pinned private infrastructure binding source/);
  assert.match(stagingBlock, /PDS_INFRA_PUBLIC_DEPLOY_KEY/);
  assert.match(stagingBlock, /sha256sum "\$private_binding"/);
  assert.match(stagingBlock, /export-private-infrastructure\.ts/);
  assert.match(stagingBlock, /pages secret put PRIVATE_INFRASTRUCTURE_JSON/);
  assert.match(stagingBlock, /--env preview/);
});

test('current consumer shares the verified immutable public-data workflow', () => {
  const workflow = fixture('.github/workflows/sync-data-products.yml');
  assert.match(workflow, /data-product-published/);
  assert.match(workflow, /approve-pr-ci\.ts/);
  assert.doesNotMatch(
    workflow,
    /export[_-]knowledge|repository: BakerSean168\/personal-digital-system/,
  );
  for (const raw of [
    fixture('scripts/data-products/prepare-infra-public-v2.sh'),
    fixture('scripts/data-products/fetch-infra-public-v2.sh'),
  ]) {
    assert.match(raw, /prepare-infra-public-v2\.ts/);
    assert.doesNotMatch(raw, /producer-root|export_infra|python|git -C|gh release download/);
  }
  assert.equal(
    packageJson.scripts['sync:data-products:infra'],
    'bash scripts/data-products/prepare-infra-public-v2.sh',
  );
});

test('obsolete PDS producer does not exist in any active build or sync workflow', () => {
  for (const raw of [ciWorkflow, candidateWorkflow, productionWorkflow]) {
    assert.doesNotMatch(raw, /repository: BakerSean168\/personal-digital-system|pds-catalog-v1/);
  }
  assert.equal(
    existsSync(
      fileURLToPath(new URL('../.github/workflows/sync-pds-catalog-v1.yml', import.meta.url)),
    ),
    false,
  );
  assert.equal(
    existsSync(
      fileURLToPath(new URL('../scripts/data-products/prepare-pds-catalog-v1.ts', import.meta.url)),
    ),
    false,
  );
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
  assert.match(releaseWorkflow, /pull-requests: write/);
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
  assert.doesNotMatch(productionWorkflow, /AI_USAGE_HUB_(URL|READ_KEY)/);
});

test('production v6 revalidates producer locks and protected binding before deployment', () => {
  const workflow = parse(productionWorkflow);
  const steps = workflow.jobs.deploy.steps;
  const validation = steps.findIndex((step: { run?: string }) =>
    step.run?.includes('scripts/delivery/revalidate.ts'),
  );
  const unpack = steps.findIndex(
    (step: { name?: string }) => step.name === 'Verify and unpack immutable Pages artifact',
  );
  const binding = steps.findIndex(
    (step: { name?: string }) => step.name === 'Generate and update encrypted Pages bindings',
  );
  assert.ok(validation >= 0 && validation < unpack && unpack < binding);
  assert.match(steps[validation].run, /manifest\.ts validate/);
  assert.match(steps[validation].run, /revalidate\.ts/);
  const checkout = steps.find(
    (step: { with?: { repository?: string } }) =>
      step.with?.repository === 'BakerSean168/personal-infrastructure',
  );
  assert.ok(checkout.with.ref.includes('private_infrastructure_source_revision'));
  assert.ok(steps[binding].run.includes('--contract "$PDS_PRIVATE_INFRASTRUCTURE_BINDING"'));
  assert.doesNotMatch(
    productionWorkflow,
    /digital-biome\.release\/v[1-5]\b|private-thought-forest|export:private:legacy/,
  );
  const revalidate = fixture('scripts/delivery/revalidate.ts');
  for (const gate of [
    'assertCommittedInputs',
    'private checkout revision mismatch',
    'private binding digest mismatch',
    'prepareAllPublicDataProducts',
    'private-infrastructure-binding.test.ts',
  ])
    assert.ok(revalidate.includes(gate));
});

test('quality gates are part of the canonical verify contract', () => {
  assert.equal(
    packageJson.scripts['lint:biome'],
    'biome lint --diagnostic-level=warn --error-on-warnings .',
  );
  assert.match(packageJson.scripts['lint:oxlint'], /oxlint --deny-warnings/);
  assert.equal(packageJson.scripts['lint:astro'], 'tsx scripts/lint-astro-scripts.ts');
  assert.equal(packageJson.scripts.lint, 'pnpm lint:biome && pnpm lint:oxlint && pnpm lint:astro');
  assert.equal(packageJson.scripts['format:check'], 'tsx scripts/check-format-ratchet.ts');
  assert.equal(packageJson.scripts.quality, 'pnpm lint && pnpm format:check');
  assert.equal(
    packageJson.scripts['preflight:data-products'],
    'tsx scripts/data-products/preflight.ts',
  );
  // Read-only cache preflight runs first so stale local data products are reported
  // with a recovery command instead of surfacing as an opaque digest mismatch.
  assert.match(packageJson.scripts.verify, /^pnpm preflight:data-products && pnpm quality && /);
  assert.match(ciWorkflow, /- 'biome\.json'/);
  assert.match(ciWorkflow, /- '\.oxfmtrc\.json'/);
  assert.match(ciWorkflow, /- '\.oxlintrc\.json'/);
  assert.match(ciWorkflow, /- '\.github\/workflows\/\*\*'/);
});
