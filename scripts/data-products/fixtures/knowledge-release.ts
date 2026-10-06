import { semanticSha256, sha256 } from '../semantic-digest';
import { parsePublicDataProductLock } from '../lock-v1';

export function knowledgeReleaseFixture() {
  const revision = '0123456789abcdef0123456789abcdef01234567';
  const product = 'knowledge-public-v1';
  const repository = 'BakerSean168/thought-forest';
  const projection = {
    schemaVersion: 1,
    product,
    generated: true,
    editable: false,
    producer: 'pds://system/component/thought-forest',
    source: { repository: `https://github.com/${repository}.git`, revision },
    payload: {
      notes: [],
      assets: [],
      tags: [],
      linkGraph: [],
      media: [] as Array<{ path: string; mediaType: string; sha256: string; dataBase64: string }>,
    },
  };
  const manifest = Buffer.from(
    JSON.stringify({
      apiVersion: 'pds/v1alpha1',
      kind: 'DataProductManifest',
      metadata: { id: product },
      spec: {
        producer: { ref: projection.producer },
        contract: { name: 'knowledge-public', version: 'v1' },
        source: projection.source,
        artifact: {
          path: `generated/${product}.json`,
          mediaType: `application/vnd.pds.${product}+json`,
          generated: true,
          editable: false,
        },
      },
    }),
  );
  const artifact = Buffer.from(JSON.stringify(projection));
  const lock = parsePublicDataProductLock({
    protocolVersion: 1,
    product,
    producerRepository: repository,
    sourceRevision: revision,
    releaseTag: `${product}-${revision}`,
    artifact: { name: `${product}.json`, sha256: sha256(artifact) },
    manifest: { name: `${product}.manifest.json`, sha256: sha256(manifest) },
    semanticSha256: semanticSha256(projection),
  });
  const release = {
    id: 1,
    tag_name: lock.releaseTag,
    draft: false,
    prerelease: true,
    published_at: '2026-10-02T13:15:35Z',
    target_commitish: 'main',
    assets: [
      { id: 11, name: lock.artifact.name, size: artifact.length, digest: lock.artifact.sha256 },
      { id: 12, name: lock.manifest.name, size: manifest.length, digest: lock.manifest.sha256 },
    ],
  };
  const ref = { ref: `refs/tags/${lock.releaseTag}`, object: { type: 'commit', sha: revision } };
  const calls: string[] = [];
  const responses = new Map<string, unknown>([
    [`/repos/${repository}/releases/tags/${lock.releaseTag}`, release],
    [`/repos/${repository}/git/ref/tags/${lock.releaseTag}`, ref],
    [`/repos/${repository}/releases?per_page=100&page=1`, [release]],
  ]);
  const downloads = new Map([
    [11, artifact],
    [12, manifest],
  ]);
  const transport = {
    async json(endpoint: string): Promise<unknown> {
      calls.push(endpoint);
      if (!responses.has(endpoint)) throw new Error(`HTTP 404: ${endpoint}`);
      return structuredClone(responses.get(endpoint));
    },
    async download(endpoint: string): Promise<Uint8Array> {
      calls.push(endpoint);
      const value = downloads.get(Number(endpoint.split('/').at(-1)));
      if (!value) throw new Error('HTTP 404 asset');
      return value;
    },
  };
  const event = {
    protocol_version: 1,
    product,
    producer_repository: repository,
    source_revision: revision,
    release_tag: lock.releaseTag,
    artifact: lock.artifact,
    manifest: lock.manifest,
    semantic_sha256: lock.semanticSha256,
  };
  return {
    lock,
    event,
    artifact,
    manifest,
    projection,
    release,
    ref,
    calls,
    responses,
    downloads,
    transport,
  };
}
