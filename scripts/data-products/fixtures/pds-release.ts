import { parsePublicDataProductLock } from '../lock-v1';
import { semanticSha256, sha256 } from '../semantic-digest';

export const historicalPdsRevision = '21aceab6bd6c551bfae24f23a1637fe3847f5441';

/** Synthetic domain fixture; real migration bytes remain generated, never copied into Git. */
export function pdsReleaseFixture(bytes?: { artifact: Buffer; manifest: Buffer }) {
  const product = 'pds-catalog-v1';
  const repository = 'BakerSean168/personal-digital-system';
  const projection = {
    schemaVersion: 1,
    product,
    generated: true,
    editable: false,
    producer: 'pds://system/component/personal-digital-system',
    source: {
      repository: `https://github.com/${repository}.git`,
      revision: historicalPdsRevision,
    },
    payload: {
      domains: [
        {
          id: 'presentation',
          name: 'Presentation',
          repositories: [{ id: 'digital-biome', relation: 'canonical' }],
        },
      ],
      repositories: [{ id: 'digital-biome', domainId: 'presentation', relation: 'canonical' }],
      summary: { domainCount: 1, repositoryCount: 1, projectionCount: 0 },
    },
  };
  const artifact = bytes?.artifact ?? Buffer.from(JSON.stringify(projection));
  const manifest =
    bytes?.manifest ??
    Buffer.from(
      JSON.stringify({
        apiVersion: 'pds/v1alpha1',
        kind: 'DataProductManifest',
        metadata: { id: product },
        spec: {
          producer: { ref: projection.producer },
          contract: { name: 'pds-catalog', version: 'v1' },
          source: projection.source,
          artifact: {
            path: 'generated/pds-catalog-v1.json',
            mediaType: 'application/vnd.pds.catalog-v1+json',
            generated: true,
            editable: false,
          },
        },
      }),
    );
  const lock = parsePublicDataProductLock({
    protocolVersion: 1,
    product,
    producerRepository: repository,
    sourceRevision: historicalPdsRevision,
    releaseTag: `${product}-${historicalPdsRevision}`,
    artifact: { name: `${product}.json`, sha256: sha256(artifact) },
    manifest: { name: `${product}.manifest.json`, sha256: sha256(manifest) },
    semanticSha256: semanticSha256(JSON.parse(artifact.toString('utf8'))),
  });
  const release = {
    id: 402343236,
    tag_name: lock.releaseTag,
    draft: false,
    prerelease: true,
    published_at: '2026-10-03T05:22:11Z',
    target_commitish: 'main',
    assets: [
      {
        id: 11,
        name: lock.artifact.name,
        state: 'uploaded',
        size: artifact.length,
        digest: lock.artifact.sha256,
      },
      {
        id: 12,
        name: lock.manifest.name,
        state: 'uploaded',
        size: manifest.length,
        digest: lock.manifest.sha256,
      },
    ],
  };
  const ref = {
    ref: `refs/tags/${lock.releaseTag}`,
    object: { type: 'commit', sha: historicalPdsRevision },
  };
  const base = `/repos/${repository}`;
  const calls: string[] = [];
  const responses = new Map<string, unknown>([
    [`${base}/releases/tags/${lock.releaseTag}`, release],
    [`${base}/git/ref/tags/${lock.releaseTag}`, ref],
    [`${base}/releases?per_page=100&page=1`, [release]],
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
      const bytes = downloads.get(Number(endpoint.split('/').at(-1)));
      if (!bytes) throw new Error('HTTP 404 asset');
      return bytes;
    },
  };
  const event = {
    protocol_version: 1,
    product,
    producer_repository: repository,
    source_revision: lock.sourceRevision,
    release_tag: lock.releaseTag,
    artifact: lock.artifact,
    manifest: lock.manifest,
    semantic_sha256: lock.semanticSha256,
  };
  return {
    lock,
    event,
    projection,
    artifact,
    manifest,
    release,
    ref,
    base,
    calls,
    responses,
    downloads,
    transport,
  };
}
