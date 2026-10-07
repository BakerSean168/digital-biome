import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCandidate } from './manifest';
import { assertCommittedInputs } from './revalidate';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'biome-inputs-'));
  fs.cpSync('data-products', path.join(root, 'data-products'), { recursive: true });
  const read = (product: string) =>
    JSON.parse(fs.readFileSync(path.join(root, `data-products/${product}.lock.json`), 'utf8'));
  const products = ['knowledge-public-v1', 'pds-catalog-v1', 'infra-public-v2'];
  const manifest = createCandidate({
    gitSha: 'a'.repeat(40),
    ciRunId: '123',
    dataProducts: Object.fromEntries(products.map((p) => [p, read(p)])),
    privateBindings: {
      'digital-biome-private-infrastructure-v1': read('digital-biome-private-infrastructure-v1'),
    },
    artifact: { file: 'digital-biome-pages.tar.gz', sha256: `sha256:${'b'.repeat(64)}`, bytes: 1 },
  });
  return { root, read, manifest, products };
}

test('promotion accepts only the exact full committed public and private input identities', () => {
  const { root, manifest, read, products } = fixture();
  try {
    assertCommittedInputs(manifest, root);
    for (const product of [...products, 'digital-biome-private-infrastructure-v1']) {
      const file = path.join(root, `data-products/${product}.lock.json`);
      const original = fs.readFileSync(file);
      const changed = read(product);
      if (product.startsWith('digital-biome-private')) changed.sha256 = `sha256:${'c'.repeat(64)}`;
      else changed.semanticSha256 = `sha256:${'c'.repeat(64)}`;
      fs.writeFileSync(file, JSON.stringify(changed));
      assert.throws(() => assertCommittedInputs(manifest, root), /committed lock mismatch/);
      fs.writeFileSync(file, original);
    }
    assert.throws(
      () => assertCommittedInputs({ ...manifest, digest: 'sha256:' + 'd'.repeat(64) }, root),
      /digest mismatch/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
