import { parsePublicDataProductLock } from '../lock-v1';
import { semanticSha256, sha256 } from '../semantic-digest';

// Historical semantic no-op: producer main advanced without publishing a new product.
export const historicalInfraRevision = '88f5e8dd1865e373cdfec3b0c3dcce1dbb7f4df7';

export function infraReleaseFixture() {
  const product = 'infra-public-v2';
  const repository = 'BakerSean168/personal-infrastructure';
  const projection = {
    schemaVersion: 2,
    product,
    generated: true,
    editable: false,
    producer: 'pds://system/component/personal-infrastructure',
    source: {
      repository: `https://github.com/${repository}.git`,
      revision: historicalInfraRevision,
    },
    payload: {
      hosts: [],
      deployments: [],
      resources: [
        {
          id: 'svc-historical',
          kind: 'service',
          title: 'Historical service',
          description: '',
          status: 'active',
          groups: [],
          links: [{ label: 'Protected endpoint', kind: 'dashboard', privateRef: 'historical.url' }],
        },
      ],
      connections: [] as Array<{ from: string; to: string; kind: string }>,
      summary: {
        hostCount: 0,
        deploymentCount: 0,
        activeEnvironmentCount: 0,
        resourceCount: 1,
        activeResourceCount: 1,
        connectionCount: 0,
      },
    },
  };
  const artifact = Buffer.from(JSON.stringify(projection));
  const manifest = Buffer.from(
    JSON.stringify({
      apiVersion: 'pds/v1alpha1',
      kind: 'DataProductManifest',
      metadata: { id: product },
      spec: {
        producer: { ref: projection.producer },
        contract: { name: 'infra-public', version: 'v2' },
        source: projection.source,
        artifact: {
          path: 'generated/infra-public-v2.json',
          mediaType: 'application/vnd.pds.infra-public-v2+json',
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
    sourceRevision: historicalInfraRevision,
    releaseTag: `${product}-${historicalInfraRevision}`,
    artifact: { name: `${product}.json`, sha256: sha256(artifact) },
    manifest: { name: `${product}.manifest.json`, sha256: sha256(manifest) },
    semanticSha256: semanticSha256(projection),
  });
  const release = {
    id: 402531799,
    tag_name: lock.releaseTag,
    draft: false,
    prerelease: true,
    published_at: '2026-10-03T13:46:42Z',
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
    object: { type: 'commit', sha: historicalInfraRevision },
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
