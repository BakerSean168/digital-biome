import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  infraProjectionSummary,
  materializeInfraPublicV1,
  parseInfraPublicV1,
  type InfraPublicV1,
} from './infra-public-v1';

function fixture(): InfraPublicV1 {
  return {
    schemaVersion: 1,
    product: 'infra-public-v1',
    generated: true,
    editable: false,
    producer: 'pds://system/component/personal-infrastructure',
    source: {
      repository: 'https://github.com/BakerSean168/personal-infrastructure.git',
      revision: 'abcdef1234567890abcdef1234567890abcdef12',
    },
    payload: {
      hosts: [
        {
          id: 'gcp-dev-01',
          provider: 'google-cloud',
          roles: ['development'],
        },
      ],
      deployments: [
        {
          componentRef: 'pds://system/component/digital-biome',
          environments: [
            {
              name: 'dev',
              host: 'gcp-dev-01',
              runtime: 'direct',
              lifecycle: 'on-demand',
              desiredState: 'active',
              publicUrls: ['https://example.com'],
            },
          ],
        },
      ],
      summary: {
        hostCount: 1,
        deploymentCount: 1,
        activeEnvironmentCount: 1,
      },
    },
  };
}

test('accepts the producer-owned infra public projection envelope', () => {
  const projection = parseInfraPublicV1(JSON.stringify(fixture()));
  assert.deepEqual(infraProjectionSummary(projection), {
    sourceRevision: 'abcdef1234567890abcdef1234567890abcdef12',
    hosts: 1,
    deployments: 1,
    activeEnvironments: 1,
  });
});

test('fails closed on provenance and host-reference drift', () => {
  const wrongRepository = fixture();
  wrongRepository.source.repository = 'https://example.invalid/infra.git';
  assert.throws(
    () => parseInfraPublicV1(JSON.stringify(wrongRepository)),
    /source provenance is invalid/,
  );

  const unknownHost = fixture();
  unknownHost.payload.deployments[0].environments[0].host = 'missing-host';
  assert.throws(() => parseInfraPublicV1(JSON.stringify(unknownHost)), /references unknown host/);
});

test('fails closed when payload summary no longer matches the projection', () => {
  const value = fixture();
  value.payload.summary.activeEnvironmentCount = 0;
  assert.throws(
    () => parseInfraPublicV1(JSON.stringify(value)),
    /summary does not match payload contents/,
  );
});

test('fails closed on unexpected fields outside the public contract', () => {
  const raw = JSON.stringify(fixture()).replace(
    '"provider":"google-cloud"',
    '"provider":"google-cloud","unexpected":"value"',
  );
  assert.throws(() => parseInfraPublicV1(raw), /unexpected field/);
});

test('materializes a validated projection without changing its provenance envelope', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'infra-public-v1-consumer-'));
  const output = path.join(root, 'infra-public-v1.json');
  try {
    const projection = parseInfraPublicV1(JSON.stringify(fixture()));
    materializeInfraPublicV1(projection, output);
    const materialized = parseInfraPublicV1(fs.readFileSync(output, 'utf8'));
    assert.deepEqual(materialized, projection);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
