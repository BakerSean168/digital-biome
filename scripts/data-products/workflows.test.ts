import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { parse } from 'yaml';
import { publicDataProducts } from './registry';
import { knowledgeReleaseFixture } from './fixtures/knowledge-release';
import { infraReleaseFixture } from './fixtures/infra-release';

const root = new URL('../../.github/workflows/', import.meta.url);
const read = (name: string) => fs.readFileSync(new URL(name, root), 'utf8');

test('only generic sync handles the standard event, with manual exact recovery and shared reconciliation', () => {
  const listeners = fs.readdirSync(root).filter((name) => {
    const workflow = parse(read(name));
    return workflow.on?.repository_dispatch?.types?.includes('data-product-published');
  });
  assert.deepEqual(listeners, ['sync-data-products.yml']);
  const sync = parse(read('sync-data-products.yml'));
  assert.deepEqual(Object.keys(sync.on.workflow_dispatch.inputs), ['product', 'release_tag']);
  assert.equal(
    sync.jobs.sync.concurrency.group,
    `data-product-\${{ inputs.product || github.event.client_payload.product }}`,
  );
  assert.equal(sync.jobs.sync.concurrency['cancel-in-progress'], false);
  const steps = sync.jobs.sync.steps;
  const route = steps.findIndex((step: { id?: string }) => step.id === 'route');
  const token = steps.findIndex((step: { id?: string }) => step.id === 'producer-token');
  assert.ok(route < token);
  assert.equal(steps[token].with.repositories, `\${{ steps.route.outputs.producer_repository }}`);
  assert.equal(steps[token].with['permission-contents'], 'read');
  const pr = steps.find((step: { id?: string }) => step.id === 'pr');
  assert.equal(pr.env.SYNC_BRANCH, `\${{ steps.route.outputs.branch }}`);
  assert.equal(pr.env.LOCK_PATH, `\${{ steps.route.outputs.lock_path }}`);
  const reconcile = parse(read('reconcile-data-products.yml'));
  assert.equal(reconcile.on.schedule[0].cron, '17 */6 * * *');
  assert.equal(reconcile.jobs.products.uses, './.github/workflows/sync-data-products.yml');
  assert.equal(reconcile.jobs.products.with.reconcile, true);
  assert.equal(reconcile.jobs.products.with.product, `\${{ matrix.product }}`);
  assert.equal(reconcile.jobs.products.strategy['fail-fast'], false);
  assert.deepEqual(
    reconcile.jobs.products.strategy.matrix.product,
    publicDataProducts.filter((d) => d.genericConsumption).map((d) => d.product),
  );
  const raw = read('sync-data-products.yml');
  assert.match(raw, /update-lock\.ts route "\$mode"/);
  assert.match(raw, /update-lock\.ts "\$MODE" "\$PRODUCT"/);
  assert.match(raw, /git add -- "\$LOCK_PATH"/);
  assert.match(raw, /--force-with-lease=/);
  assert.match(raw, /gh workflow run check\.yml/);
  assert.match(raw, /select\(\.headSha ==/);
  assert.match(raw, /\.headSha == \$sha and \.conclusion == "success"/);
  assert.match(raw, /headRefOid/);
  assert.doesNotMatch(
    raw,
    /gh pr merge|--auto|export[_-]knowledge|repository: BakerSean168\/thought-forest/,
  );
});

test('knowledge legacy rollback trigger stays separate and cannot write an obsolete schema lock', () => {
  const raw = read('sync-knowledge-public-v1.yml');
  assert.deepEqual(parse(raw).on.repository_dispatch.types, ['knowledge-public-v1-published']);
  assert.match(raw, /update-lock\.ts shadow knowledge-public-v1/);
  assert.doesNotMatch(raw, /schemaVersion: 1/);
});

test('legacy infra entrypoint is only a manual alias to shared reconciliation, not a second writer', () => {
  const raw = read('sync-infra-public-v2.yml');
  const legacy = parse(raw);
  assert.deepEqual(Object.keys(legacy.on), ['workflow_dispatch']);
  assert.equal(legacy.jobs.reconcile.uses, './.github/workflows/sync-data-products.yml');
  assert.deepEqual(legacy.jobs.reconcile.with, { product: 'infra-public-v2', reconcile: true });
  assert.doesNotMatch(
    raw,
    /schedule:|repository_dispatch:|checkout|export_infra|source_sha|git push/,
  );
  for (const name of ['check.yml', 'candidate-publish.yml']) {
    const workflow = parse(read(name));
    const job = workflow.jobs.check ?? workflow.jobs['build-candidate'];
    const text = JSON.stringify(job);
    assert.doesNotMatch(
      text,
      /producer-root|personal-infrastructure-public|export_infra|pip install|PDS_INFRA_PUBLIC_DEPLOY_KEY/,
    );
    const prepare = job.steps.find(
      (step: { run?: string }) => step.run === 'scripts/data-products/prepare-infra-public-v2.sh',
    );
    assert.equal(prepare.env.GH_TOKEN, `\${{ steps.vault-token.outputs.token }}`);
  }
});

test('actual workflow route command validates event/manual/reconcile before credentials and emits only registry policy', () => {
  const workflow = parse(read('sync-data-products.yml'));
  const route = workflow.jobs.sync.steps.find((step: { id?: string }) => step.id === 'route');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-route-'));
  try {
    const eventPath = path.join(root, 'event.json');
    const outputPath = path.join(root, 'output');
    for (const fixture of [knowledgeReleaseFixture, infraReleaseFixture]) {
      const f = fixture();
      for (const mode of ['event', 'manual', 'reconcile']) {
        fs.writeFileSync(
          eventPath,
          JSON.stringify(
            mode === 'event'
              ? { action: 'data-product-published', client_payload: f.event }
              : { inputs: { product: f.lock.product, release_tag: f.lock.releaseTag } },
          ),
        );
        fs.writeFileSync(outputPath, '');
        const run = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', route.run], {
          encoding: 'utf8',
          timeout: 20_000,
          env: {
            ...process.env,
            GH_TOKEN: '',
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_OUTPUT: outputPath,
            GITHUB_EVENT_NAME:
              mode === 'event'
                ? 'repository_dispatch'
                : mode === 'manual'
                  ? 'workflow_dispatch'
                  : 'schedule',
            RECONCILE: String(mode === 'reconcile'),
            RECONCILE_PRODUCT: f.lock.product,
          },
        });
        assert.equal(run.status, 0, run.stderr);
        const output = Object.fromEntries(
          fs
            .readFileSync(outputPath, 'utf8')
            .trim()
            .split('\n')
            .map((line) => line.split('=')),
        );
        assert.deepEqual(output, {
          mode,
          product: f.lock.product,
          producer_repository: f.lock.producerRepository.split('/')[1],
          branch: `automation/data-product-${f.lock.product}`,
          lock_path: `data-products/${f.lock.product}.lock.json`,
        });
      }
    }
    for (const product of [
      'pds-catalog-v1',
      'digital-biome-private-infrastructure-v1',
      'infra-public-v2\nbranch=main',
    ]) {
      fs.writeFileSync(outputPath, '');
      const run = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', route.run], {
        encoding: 'utf8',
        timeout: 20_000,
        env: {
          ...process.env,
          GITHUB_OUTPUT: outputPath,
          RECONCILE: 'true',
          RECONCILE_PRODUCT: product,
        },
      });
      assert.notEqual(run.status, 0);
      assert.equal(fs.readFileSync(outputPath, 'utf8'), '');
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
