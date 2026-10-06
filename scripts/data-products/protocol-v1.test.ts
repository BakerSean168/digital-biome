import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { publicDataProducts, getPublicDataProduct } from './registry';
import {
  parsePublicDataProductLock,
  parseDataProductPublished,
  canonicalLockIdentity,
} from './lock-v1';
import { canonicalJson, canonicalSemanticBytes, semanticSha256 } from './semantic-digest';

const fixture = JSON.parse(
  fs.readFileSync(
    new URL('./fixtures/data-product-semantic-digest-v1.json', import.meta.url),
    'utf8',
  ),
);
const examples = JSON.parse(
  fs.readFileSync(new URL('./fixtures/data-product-protocol-v1.json', import.meta.url), 'utf8'),
);

test('registry has exactly the three public producers and excludes private bindings', () => {
  assert.deepEqual(
    publicDataProducts.map((d) => [d.product, d.producerRepository]),
    [
      ['knowledge-public-v1', 'BakerSean168/thought-forest'],
      ['pds-catalog-v1', 'BakerSean168/personal-digital-system'],
      ['infra-public-v2', 'BakerSean168/personal-infrastructure'],
    ],
  );
  for (const d of publicDataProducts) {
    assert.equal(d.artifactName, `${d.product}.json`);
    assert.equal(d.manifestName, `${d.product}.manifest.json`);
    assert.equal(d.lockPath, `data-products/${d.product}.lock.json`);
    assert.equal(d.buildTime, true);
    assert.equal(typeof d.parseArtifact, 'function');
    assert.ok(d.materializer);
    assert.throws(() => getPublicDataProduct(d.product, 'BakerSean168/foreign'));
  }
  for (const product of ['unknown', 'digital-biome-private-infrastructure-v1', null, '__proto__']) {
    assert.throws(() => getPublicDataProduct(product, 'BakerSean168/personal-infrastructure'));
  }
});

test('reviewed lock fixture parses and identity serialization ignores local metadata', () => {
  const lock = parsePublicDataProductLock(examples.lock);
  assert.deepEqual(lock, examples.lock);
  assert.equal(
    canonicalLockIdentity({ ...lock, consumerMetadata: { product: 'not authority' } }),
    canonicalLockIdentity(lock),
  );
  assert.deepEqual(JSON.parse(canonicalLockIdentity(lock)), lock);
});

test('lock and event reject malformed identities with equivalent validation', () => {
  const asEvent = (lock: Record<string, unknown>) => ({
    protocol_version: lock.protocolVersion,
    product: lock.product,
    producer_repository: lock.producerRepository,
    source_revision: lock.sourceRevision,
    release_tag: lock.releaseTag,
    artifact: lock.artifact,
    manifest: lock.manifest,
    semantic_sha256: lock.semanticSha256,
  });
  for (const d of publicDataProducts) {
    const valid = {
      ...examples.lock,
      product: d.product,
      producerRepository: d.producerRepository,
      releaseTag: `${d.product}-${examples.lock.sourceRevision}`,
      artifact: { ...examples.lock.artifact, name: d.artifactName },
      manifest: { ...examples.lock.manifest, name: d.manifestName },
    };
    assert.deepEqual(parseDataProductPublished(asEvent(valid)), parsePublicDataProductLock(valid));
    for (const key of Object.keys(valid)) {
      for (const bad of [null, undefined, [], {}, '', 1, true]) {
        if (key === 'protocolVersion' && bad === 1) continue;
        const changed = { ...valid, [key]: bad };
        assert.throws(() => parsePublicDataProductLock(changed), `${d.product}.${key}`);
        assert.throws(
          () => parseDataProductPublished(asEvent(changed)),
          `${d.product}.${key} event`,
        );
      }
    }
    const mutations = [
      { product: 'unknown' },
      { producerRepository: 'BakerSean168/foreign' },
      { sourceRevision: 'A'.repeat(40) },
      { sourceRevision: `${'a'.repeat(40)}\n` },
      { sourceRevision: 'a'.repeat(39) },
      { sourceRevision: 'f'.repeat(40) },
      { releaseTag: 'main' },
      { releaseTag: `${d.product}-${'f'.repeat(40)}` },
      { semanticSha256: `sha256:${'A'.repeat(64)}` },
      { semanticSha256: `${examples.lock.semanticSha256}\n` },
    ];
    for (const mutation of mutations) {
      const changed = { ...valid, ...mutation };
      assert.throws(() => parsePublicDataProductLock(changed));
      assert.throws(() => parseDataProductPublished(asEvent(changed)));
    }
    for (const key of ['artifact', 'manifest'] as const) {
      for (const bad of [
        { ...valid[key], name: 'wrong.json' },
        { ...valid[key], extra: true },
        { ...valid[key], sha256: null },
        { ...valid[key], sha256: 'a'.repeat(64) },
        { ...valid[key], sha256: `sha256:${'A'.repeat(64)}` },
      ]) {
        const changed = { ...valid, [key]: bad };
        assert.throws(() => parsePublicDataProductLock(changed));
        assert.throws(() => parseDataProductPublished(asEvent(changed)));
      }
    }
  }
  for (const value of [null, [], 1, 'lock']) {
    assert.throws(() => parsePublicDataProductLock(value));
    assert.throws(() => parseDataProductPublished(value));
  }
  for (const value of [null, [], 'metadata']) {
    assert.throws(() => parsePublicDataProductLock({ ...examples.lock, consumerMetadata: value }));
  }
  assert.throws(() => parsePublicDataProductLock({ ...examples.lock, extra: true }));
  assert.throws(() => parseDataProductPublished({ ...examples.event, consumerMetadata: {} }));
  assert.deepEqual(parseDataProductPublished(examples.event).product, 'pds-catalog-v1');
  for (const invalid of examples.invalid_events)
    assert.throws(() => parseDataProductPublished(invalid.payload));
  for (const invalid of examples.invalid_locks)
    assert.throws(() => parsePublicDataProductLock(invalid.payload));
});

test('canonicalization preserves array order, sorts integer and Unicode keys, and excludes provenance', () => {
  const artifact = structuredClone(fixture.equivalent_artifacts[0]);
  artifact.payload.items.reverse();
  assert.notEqual(semanticSha256(artifact), fixture.sha256);
  assert.equal(
    canonicalJson({ '2': 2, '10': 10, '\u{10000}': 1, '\uE000': 2 }),
    '{"10":10,"2":2,"\uE000":2,"\u{10000}":1}',
  );
  assert.throws(() => canonicalJson('\uD800'), /Unicode/);
  assert.throws(() => canonicalSemanticBytes({}), /JSON values/);
  // Reviewer P2: fixture establishes integer-domain conformance, not Python/JS
  // float formatting parity (including 1.0/-0.0 or numbers beyond JS precision).
  for (const number of [0.5, -0, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => canonicalJson(number), /numeric domain/);
  }
});

test('reviewed semantic fixture has exact UTF-8 bytes and digest', () => {
  for (const artifact of fixture.equivalent_artifacts) {
    assert.deepEqual(canonicalSemanticBytes(artifact), Buffer.from(fixture.canonical, 'utf8'));
    assert.equal(semanticSha256(artifact), fixture.sha256);
  }
});
