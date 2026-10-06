import { getPublicDataProduct, type PublicDataProductDefinition } from './registry';
import {
  assertRecord,
  canonicalLockIdentity,
  parseDataProductPublished,
  parsePublicDataProductLock,
  type PublicDataProductLock,
} from './lock-v1';
import { semanticSha256, sha256 } from './semantic-digest';

/**
 * Trust boundary supplied by the Release reader, independently of the event/lock.
 * sourceRevision MUST be the dereferenced Git tag commit, not target_commitish
 * (which GitHub may report as a mutable branch). The reader owns Release existence,
 * non-draft status and tag resolution. These strings alone do not prove those facts.
 */
export interface VerifiedReleaseTag {
  producerRepository: string;
  releaseTag: string;
  sourceRevision: string;
}

export interface PublicationInput {
  identity: { kind: 'lock' | 'event'; value: unknown };
  tag: VerifiedReleaseTag;
  artifact: { name: string; bytes: Uint8Array };
  manifest: { name: string; bytes: Uint8Array };
}

function verifyManifest(
  value: unknown,
  lock: PublicDataProductLock,
  definition: PublicDataProductDefinition,
): void {
  assertRecord(value, 'manifest');
  assertRecord(value.metadata, 'manifest metadata');
  assertRecord(value.spec, 'manifest spec');
  const spec = value.spec;
  assertRecord(spec.producer, 'manifest producer');
  assertRecord(spec.contract, 'manifest contract');
  assertRecord(spec.source, 'manifest source');
  assertRecord(spec.artifact, 'manifest artifact');
  if (
    value.apiVersion !== 'pds/v1alpha1' ||
    value.kind !== 'DataProductManifest' ||
    value.metadata.id !== definition.product ||
    spec.producer.ref !== definition.producer ||
    spec.contract.name !== definition.contractName ||
    spec.contract.version !== definition.contractVersion ||
    spec.source.repository !== `https://github.com/${definition.producerRepository}.git` ||
    spec.source.revision !== lock.sourceRevision ||
    spec.artifact.path !== definition.artifactPath ||
    spec.artifact.mediaType !== definition.mediaType ||
    spec.artifact.generated !== true ||
    spec.artifact.editable !== false
  )
    throw new Error('Publication manifest contract mismatch');
}

/** Pure verification only: no network, filesystem writes or materialization. */
export function verifyPublication(input: PublicationInput) {
  let lock: PublicDataProductLock;
  switch (input.identity.kind) {
    case 'lock':
      lock = parsePublicDataProductLock(input.identity.value);
      break;
    case 'event':
      lock = parseDataProductPublished(input.identity.value);
      break;
    default:
      throw new Error('Unknown publication identity kind');
  }
  const definition = getPublicDataProduct(lock.product, lock.producerRepository);
  if (
    !input.tag ||
    input.tag.producerRepository !== lock.producerRepository ||
    input.tag.releaseTag !== lock.releaseTag ||
    input.tag.sourceRevision !== lock.sourceRevision
  ) {
    throw new Error('Release tag identity mismatch');
  }
  for (const key of ['artifact', 'manifest'] as const) {
    if (input[key]?.name !== lock[key].name)
      throw new Error(`Publication ${key} asset name mismatch`);
    if (
      !(input[key].bytes instanceof Uint8Array) ||
      sha256(input[key].bytes) !== lock[key].sha256
    ) {
      throw new Error(`Publication ${key} digest mismatch`);
    }
  }
  // Fatal UTF-8 decoding prevents replacement characters from changing hashed meaning.
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  verifyManifest(JSON.parse(decoder.decode(input.manifest.bytes)), lock, definition);
  const projection = definition.parseArtifact(decoder.decode(input.artifact.bytes));
  if (projection.source.revision !== lock.sourceRevision)
    throw new Error('Publication source revision mismatch');
  if (semanticSha256(projection) !== lock.semanticSha256)
    throw new Error('Publication semantic digest mismatch');
  const canonicalIdentity = canonicalLockIdentity(lock);
  // Annotations are not verified producer identity and must not escape as such.
  const { consumerMetadata: _metadata, ...identity } = lock;
  return { identity, canonicalIdentity, projection };
}
