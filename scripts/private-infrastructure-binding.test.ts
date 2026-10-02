import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parsePrivateInfrastructureBinding } from './export-private-infrastructure';

function fixture() {
  return {
    apiVersion: 'pds/v1alpha1',
    kind: 'RuntimeBinding',
    metadata: { id: 'digital-biome-private-infrastructure-v1' },
    spec: {
      producer: { ref: 'pds://system/component/personal-infrastructure' },
      consumer: { ref: 'pds://system/component/digital-biome' },
      contract: { name: 'digital-biome-private-infrastructure', version: 'v1' },
      payload: {
        version: 1,
        values: { 'host-example.ip': '203.0.113.10' },
        links: { 'svc-example.links.admin': 'https://private.example.test/' },
      },
    },
  };
}

test('parses the producer-owned private infrastructure runtime binding', () => {
  const payload = parsePrivateInfrastructureBinding(JSON.stringify(fixture()));
  assert.equal(payload.version, 1);
  assert.equal(payload.values['host-example.ip'], '203.0.113.10');
  assert.equal(payload.links['svc-example.links.admin'], 'https://private.example.test/');
});

test('rejects wrong producer identity and embedded HTTP credentials', () => {
  const wrongProducer = fixture();
  wrongProducer.spec.producer.ref = 'pds://system/component/thought-forest';
  assert.throws(
    () => parsePrivateInfrastructureBinding(JSON.stringify(wrongProducer)),
    /identity mismatch/,
  );

  const credentials = fixture();
  credentials.spec.payload.links['svc-example.links.admin'] = 'https://user:secret@example.test/';
  assert.throws(
    () => parsePrivateInfrastructureBinding(JSON.stringify(credentials)),
    /configuration is invalid/,
  );
});

test('materialized private binding covers all public privateRef keys when present', (t) => {
  const contractPath = path.resolve(
    process.env.PDS_PRIVATE_INFRASTRUCTURE_BINDING ||
      '.pds-runtime/personal-infrastructure/bindings/digital-biome/private-infrastructure-v1.json',
  );
  if (!fs.existsSync(contractPath)) {
    t.skip('private infrastructure binding is not materialized in this execution');
    return;
  }

  const payload = parsePrivateInfrastructureBinding(fs.readFileSync(contractPath, 'utf8'));
  const generatedRoot = process.env.NOTES_UPSTREAM_GENERATED?.trim();
  const assetIndexPath = generatedRoot
    ? path.resolve(generatedRoot, 'knowledge-index', 'asset-index.json')
    : path.resolve('src/data/indexes/asset-index.json');
  const parsedAssetIndex = JSON.parse(fs.readFileSync(assetIndexPath, 'utf8')) as
    | Array<{ links?: Array<{ privateRef?: string }> }>
    | { entries?: Array<{ links?: Array<{ privateRef?: string }> }> };
  const entries = Array.isArray(parsedAssetIndex)
    ? parsedAssetIndex
    : (parsedAssetIndex.entries ?? []);
  const expected = new Set(
    entries.flatMap((entry) =>
      (entry.links ?? []).flatMap((link) => (link.privateRef ? [link.privateRef] : [])),
    ),
  );
  for (const privateRef of expected) {
    assert.ok(privateRef in payload.links, `runtime binding is missing ${privateRef}`);
  }

  for (const key of [
    'host-aliyun-chengdu-dailyuse-vps.ip',
    'host-azure-japan-singbox-vps.ip',
    'host-azure-korea-singbox-vps.ip',
    'host-oracle-osaka-amd-proxy-vps.ip',
    'host-oracle-osaka-arm-development-vps.ip',
  ]) {
    assert.ok(key in payload.values, `runtime binding is missing ${key}`);
  }
});
