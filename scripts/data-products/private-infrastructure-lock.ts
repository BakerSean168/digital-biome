import fs from 'node:fs';
import path from 'node:path';

export const DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT =
  'digital-biome-private-infrastructure-v1';
export const DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCER = 'BakerSean168/personal-infrastructure';
export const DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_CONTRACT_PATH =
  'bindings/digital-biome/private-infrastructure-v1.json';

const SHA_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;

export type DigitalBiomePrivateInfrastructureLock = {
  schemaVersion: 1;
  product: typeof DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT;
  producerRepository: typeof DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCER;
  sourceRevision: string;
  contractPath: typeof DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_CONTRACT_PATH;
  sha256: string;
};

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(
      `${label} fields mismatch: expected ${wanted.join(', ')}; got ${actual.join(', ')}`,
    );
  }
}

export function parseDigitalBiomePrivateInfrastructureLock(
  raw: string,
): DigitalBiomePrivateInfrastructureLock {
  const value: unknown = JSON.parse(raw);
  assertRecord(value, 'digital-biome private infrastructure lock');
  assertExactKeys(
    value,
    ['schemaVersion', 'product', 'producerRepository', 'sourceRevision', 'contractPath', 'sha256'],
    'digital-biome private infrastructure lock',
  );

  if (
    value.schemaVersion !== 1 ||
    value.product !== DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCT ||
    value.producerRepository !== DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_PRODUCER ||
    value.contractPath !== DIGITAL_BIOME_PRIVATE_INFRASTRUCTURE_CONTRACT_PATH ||
    typeof value.sourceRevision !== 'string' ||
    !SHA_RE.test(value.sourceRevision) ||
    typeof value.sha256 !== 'string' ||
    !SHA256_RE.test(value.sha256)
  ) {
    throw new Error('digital-biome private infrastructure lock identity is invalid');
  }

  return value as DigitalBiomePrivateInfrastructureLock;
}

export function loadDigitalBiomePrivateInfrastructureLock(
  file = 'data-products/digital-biome-private-infrastructure-v1.lock.json',
): DigitalBiomePrivateInfrastructureLock {
  return parseDigitalBiomePrivateInfrastructureLock(fs.readFileSync(path.resolve(file), 'utf8'));
}
