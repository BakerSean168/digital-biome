import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareAllPublicDataProducts } from './prepare-all';
import { knowledgeReleaseFixture } from './fixtures/knowledge-release';
import { infraReleaseFixture } from './fixtures/infra-release';

test('common preparation materializes both committed locks using the same Release transport and domain adapters', async () => {
  const fixtures = [knowledgeReleaseFixture(), infraReleaseFixture()];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-all-'));
  try {
    fs.mkdirSync(path.join(root, 'data-products'));
    for (const f of fixtures)
      fs.writeFileSync(
        path.join(root, 'data-products', `${f.lock.product}.lock.json`),
        JSON.stringify(f.lock),
      );
    const select = (endpoint: string) => {
      const f = fixtures.find((f) => endpoint.startsWith(`/repos/${f.lock.producerRepository}/`));
      assert.ok(f, 'only public registry producer reads are allowed');
      return f.transport;
    };
    const transport = {
      json: (endpoint: string) => select(endpoint).json(endpoint),
      download: (endpoint: string) => select(endpoint).download(endpoint),
    };
    const result = await prepareAllPublicDataProducts(transport, root);
    assert.equal(result.sourceRoot, path.join(root, '.pds-runtime/knowledge-public-v1/source'));
    assert.ok(fs.existsSync(result.sourceRoot));
    for (const f of fixtures) {
      assert.deepEqual(
        fs.readFileSync(path.join(root, '.pds-runtime', f.lock.product, f.lock.artifact.name)),
        f.artifact,
      );
      assert.ok(f.calls.every((call) => !/main|contents|private-infrastructure/.test(call)));
    }
    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(path.join(root, 'src/data/infrastructure/infra-public-v2.json'), 'utf8'),
      ),
      JSON.parse(fixtures[1].artifact.toString()),
    );
    // Malformed lock preflight cannot mutate an accepted runtime or fetch any Release.
    for (const f of fixtures) f.calls.length = 0;
    fs.writeFileSync(path.join(root, 'data-products/infra-public-v2.lock.json'), 'null');
    await assert.rejects(prepareAllPublicDataProducts(transport, root));
    assert.ok(fixtures.every((f) => f.calls.length === 0));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
