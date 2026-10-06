import { parseKnowledgePublicV1 } from './knowledge-public-v1';
import { parsePdsCatalogV1 } from '../../src/domain/system/pds-catalog-v1';
import { parseInfraPublicV2 } from '../../src/domain/infrastructure/infra-public-v2';

// Public transport policy only. Domain validation stays with these existing owners.
// Materializer identities are declarative; verification never invokes a writer.
export const publicDataProducts = Object.freeze([
  Object.freeze({
    product: 'knowledge-public-v1',
    genericConsumption: true,
    producerRepository: 'BakerSean168/thought-forest',
    producer: 'pds://system/component/thought-forest',
    artifactName: 'knowledge-public-v1.json',
    manifestName: 'knowledge-public-v1.manifest.json',
    artifactPath: 'generated/knowledge-public-v1.json',
    mediaType: 'application/vnd.pds.knowledge-public-v1+json',
    contractName: 'knowledge-public',
    contractVersion: 'v1',
    lockPath: 'data-products/knowledge-public-v1.lock.json',
    buildTime: true,
    parseArtifact: parseKnowledgePublicV1,
    materializer: 'scripts/data-products/knowledge-public-v1.ts#materializeKnowledgePublicV1Source',
  } as const),
  Object.freeze({
    product: 'pds-catalog-v1',
    genericConsumption: false,
    producerRepository: 'BakerSean168/personal-digital-system',
    producer: 'pds://system/component/personal-digital-system',
    artifactName: 'pds-catalog-v1.json',
    manifestName: 'pds-catalog-v1.manifest.json',
    artifactPath: 'generated/pds-catalog-v1.json',
    mediaType: 'application/vnd.pds.catalog-v1+json',
    contractName: 'pds-catalog',
    contractVersion: 'v1',
    lockPath: 'data-products/pds-catalog-v1.lock.json',
    buildTime: true,
    parseArtifact: parsePdsCatalogV1,
    // DPP-304 will implement this writer; no new materialization path in Batch 1.
    materializer: 'validated-json:src/data/system/pds-catalog-v1.json',
  } as const),
  Object.freeze({
    product: 'infra-public-v2',
    genericConsumption: true,
    producerRepository: 'BakerSean168/personal-infrastructure',
    producer: 'pds://system/component/personal-infrastructure',
    artifactName: 'infra-public-v2.json',
    manifestName: 'infra-public-v2.manifest.json',
    artifactPath: 'generated/infra-public-v2.json',
    mediaType: 'application/vnd.pds.infra-public-v2+json',
    contractName: 'infra-public',
    contractVersion: 'v2',
    lockPath: 'data-products/infra-public-v2.lock.json',
    buildTime: true,
    parseArtifact: parseInfraPublicV2,
    materializer: 'scripts/data-products/materialize-infra-public-v2.ts#materializeInfraPublicV2',
  } as const),
]);

export type PublicDataProductDefinition = (typeof publicDataProducts)[number];
export type PublicDataProduct = PublicDataProductDefinition['product'];

export function getPublicDataProduct(
  product: unknown,
  producerRepository: unknown,
): PublicDataProductDefinition {
  const definition = publicDataProducts.find(
    (d) => d.product === product && d.producerRepository === producerRepository,
  );
  if (!definition) throw new Error('Unknown public product/producer identity');
  return definition;
}
