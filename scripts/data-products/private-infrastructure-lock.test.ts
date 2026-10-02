import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_CONTRACT_PATH,
  DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCER,
  DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT,
  loadDigitalBiomePrivateInfrastructureLock,
  parseDigitalBiomePrivateInfrastructureLock,
} from './private-infrastructure-lock';

test('repository private infrastructure lock is valid and contains no private values', () => {
  const lock = loadDigitalBiomePrivateInfrastructureLock();
  assert.equal(lock.product, DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT);
  assert.equal(lock.producerRepository, DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCER);
  assert.equal(lock.contractPath, DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_CONTRACT_PATH);
  assert.match(lock.sourceRevision, /^[0-9a-f]{40}$/);
  assert.match(lock.sha256, /^sha256:[0-9a-f]{64}$/);
});

test('private infrastructure lock rejects extra fields and mutable refs', () => {
  const base = {
    schemaVersion: 1,
    product: DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT,
    producerRepository: DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCER,
    sourceRevision: 'a'.repeat(40),
    contractPath: DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_CONTRACT_PATH,
    sha256: `sha256:${'b'.repeat(64)}`,
  };

  assert.throws(
    () => parseDigitalBiomePrivateInfrastructureLock(JSON.stringify({ ...base, branch: 'main' })),
    /fields mismatch/,
  );
  assert.throws(
    () =>
      parseDigitalBiomePrivateInfrastructureLock(
        JSON.stringify({ ...base, sourceRevision: 'main' }),
      ),
    /identity is invalid/,
  );
});
