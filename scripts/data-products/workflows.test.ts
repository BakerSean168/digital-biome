import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';

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
  assert.equal(sync.jobs.sync.env.SYNC_BRANCH, 'automation/data-product-knowledge-public-v1');
  assert.equal(sync.jobs.sync.env.LOCK_PATH, 'data-products/knowledge-public-v1.lock.json');
  const reconcile = parse(read('reconcile-data-products.yml'));
  assert.equal(reconcile.on.schedule[0].cron, '17 */6 * * *');
  assert.equal(reconcile.jobs.knowledge.uses, './.github/workflows/sync-data-products.yml');
  assert.equal(reconcile.jobs.knowledge.with.reconcile, true);
  const raw = read('sync-data-products.yml');
  assert.match(raw, /update-lock\.ts "\$mode"/);
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

test('legacy rollback trigger stays separate and cannot write an obsolete schema lock', () => {
  const raw = read('sync-knowledge-public-v1.yml');
  assert.deepEqual(parse(raw).on.repository_dispatch.types, ['knowledge-public-v1-published']);
  assert.match(raw, /update-lock\.ts shadow knowledge-public-v1/);
  assert.doesNotMatch(raw, /schemaVersion: 1/);
});
