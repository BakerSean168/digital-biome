import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseInfraPublicV2 } from '../src/domain/infrastructure/infra-public-v2';
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

test('private RuntimeBinding covers every privateRef exported by infra-public-v2', (t) => {
  const contractPath = path.resolve(
    process.env.PDS_PRIVATE_INFRASTRUCTURE_BINDING ||
      '.pds-runtime/personal-infrastructure/bindings/digital-biome/private-infrastructure-v1.json',
  );
  const publicProjectionPath = path.resolve(
    process.env.PDS_PUBLIC_INFRASTRUCTURE_ARTIFACT ||
      'src/data/infrastructure/infra-public-v2.json',
  );
  if (!fs.existsSync(contractPath) || !fs.existsSync(publicProjectionPath)) {
    t.skip('private binding or infra-public-v2 is not materialized in this execution');
    return;
  }

  const payload = parsePrivateInfrastructureBinding(fs.readFileSync(contractPath, 'utf8'));
  const projection = parseInfraPublicV2(fs.readFileSync(publicProjectionPath, 'utf8'));

  const expectedValueRefs = new Set<string>();
  const expectedLinkRefs = new Set<string>();
  for (const resource of projection.payload.resources) {
    for (const ref of Object.values(resource.privateValues ?? {})) {
      expectedValueRefs.add(ref);
    }
    for (const link of resource.links ?? []) {
      if (link.privateRef) expectedLinkRefs.add(link.privateRef);
    }
  }

  assert.ok(expectedValueRefs.size > 0, 'infra-public-v2 must expose stable private value refs');
  assert.ok(expectedLinkRefs.size > 0, 'infra-public-v2 must expose stable private link refs');

  for (const ref of expectedValueRefs) {
    assert.ok(ref in payload.values, `runtime binding is missing value ref ${ref}`);
  }
  for (const ref of expectedLinkRefs) {
    assert.ok(ref in payload.links, `runtime binding is missing link ref ${ref}`);
  }
});
