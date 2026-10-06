import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseKnowledgePublicV1Lock,
  verifyKnowledgePublicV1Manifest,
} from './knowledge-public-v1-lock';
import { publicDataProducts } from './registry';
import { semanticSha256, sha256 } from './semantic-digest';
import { verifyPublication } from './verify-publication';

const revision = '0123456789abcdef0123456789abcdef01234567';
const payloads = {
  'knowledge-public-v1': { notes: [], assets: [], tags: [], linkGraph: [], media: [] },
  'pds-catalog-v1': {
    domains: [],
    repositories: [],
    summary: { domainCount: 0, repositoryCount: 0, projectionCount: 0 },
  },
  'infra-public-v2': {
    hosts: [],
    deployments: [],
    resources: [],
    connections: [],
    summary: {
      hostCount: 0,
      deploymentCount: 0,
      activeEnvironmentCount: 0,
      resourceCount: 0,
      activeResourceCount: 0,
      connectionCount: 0,
    },
  },
};

function fixture(d: (typeof publicDataProducts)[number]) {
  const artifact = {
    schemaVersion: d.product === 'infra-public-v2' ? 2 : 1,
    product: d.product,
    producer: d.producer,
    generated: true,
    editable: false,
    source: { repository: `https://github.com/${d.producerRepository}.git`, revision },
    payload: structuredClone(payloads[d.product]),
  };
  const manifest = {
    apiVersion: 'pds/v1alpha1',
    kind: 'DataProductManifest',
    metadata: { id: d.product },
    spec: {
      producer: { ref: d.producer },
      contract: { name: d.contractName, version: d.contractVersion },
      source: { ...artifact.source },
      artifact: {
        path: d.artifactPath,
        mediaType:
          d.product === 'pds-catalog-v1'
            ? 'application/vnd.pds.catalog-v1+json'
            : `application/vnd.pds.${d.product}+json`,
        generated: true,
        editable: false,
      },
    },
  };
  const artifactBytes = Buffer.from(JSON.stringify(artifact));
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const lock = {
    protocolVersion: 1,
    product: d.product,
    producerRepository: d.producerRepository,
    sourceRevision: revision,
    releaseTag: `${d.product}-${revision}`,
    artifact: { name: d.artifactName, sha256: sha256(artifactBytes) },
    manifest: { name: d.manifestName, sha256: sha256(manifestBytes) },
    semanticSha256: semanticSha256(artifact),
  };
  const input = {
    identity: { kind: 'lock' as const, value: lock },
    tag: {
      producerRepository: d.producerRepository,
      releaseTag: lock.releaseTag,
      sourceRevision: revision,
    },
    artifact: { name: d.artifactName, bytes: artifactBytes },
    manifest: { name: d.manifestName, bytes: manifestBytes },
  };
  return { artifact, manifest, lock, input };
}

for (const definition of publicDataProducts) {
  test(`${definition.product}: verifies bytes through the existing owner parser`, () => {
    const { artifact, lock, input } = fixture(definition);
    const verified = verifyPublication(input);
    assert.deepEqual(verified.projection, artifact);
    assert.deepEqual(verified.identity, lock);
    assert.deepEqual(JSON.parse(verified.canonicalIdentity), lock);
    const event = {
      protocol_version: 1,
      product: lock.product,
      producer_repository: lock.producerRepository,
      source_revision: lock.sourceRevision,
      release_tag: lock.releaseTag,
      artifact: lock.artifact,
      manifest: lock.manifest,
      semantic_sha256: lock.semanticSha256,
    };
    assert.deepEqual(
      verifyPublication({ ...input, identity: { kind: 'event', value: event } }),
      verified,
    );
  });

  test(`${definition.product}: rejects wrong transport identity and byte digests`, () => {
    for (const key of ['producerRepository', 'releaseTag', 'sourceRevision'] as const) {
      const { input } = fixture(definition);
      assert.throws(
        () => verifyPublication({ ...input, tag: { ...input.tag, [key]: 'wrong' } }),
        /tag identity/,
      );
    }
    for (const key of ['artifact', 'manifest'] as const) {
      const { input } = fixture(definition);
      assert.throws(
        () => verifyPublication({ ...input, [key]: { ...input[key], name: 'wrong.json' } }),
        /asset name/,
      );
      assert.throws(
        () =>
          verifyPublication({
            ...input,
            [key]: { ...input[key], bytes: Buffer.concat([input[key].bytes, Buffer.from('\n')]) },
          }),
        /digest mismatch/,
      );
    }
    const { input, lock } = fixture(definition);
    lock.semanticSha256 = `sha256:${'0'.repeat(64)}`;
    assert.throws(() => verifyPublication(input), /semantic digest mismatch/);
  });

  test(`${definition.product}: rejects forged manifest identity even with matching byte digest`, () => {
    const edits: Array<(m: ReturnType<typeof fixture>['manifest']) => void> = [
      (m) => {
        m.apiVersion = 'wrong';
      },
      (m) => {
        m.kind = 'wrong';
      },
      (m) => {
        m.metadata.id = 'wrong' as typeof m.metadata.id;
      },
      (m) => {
        m.spec.source.repository = 'https://github.com/foreign/repo.git';
      },
      (m) => {
        m.spec.source.revision = 'f'.repeat(40);
      },
      (m) => {
        m.spec.producer.ref = 'wrong' as typeof m.spec.producer.ref;
      },
      (m) => {
        m.spec.contract.name = 'wrong' as typeof m.spec.contract.name;
      },
      (m) => {
        m.spec.contract.version = 'v9' as typeof m.spec.contract.version;
      },
      (m) => {
        m.spec.artifact.path = '../wrong.json' as typeof m.spec.artifact.path;
      },
      (m) => {
        m.spec.artifact.mediaType = 'application/json';
      },
      (m) => {
        m.spec.artifact.generated = false;
      },
      (m) => {
        m.spec.artifact.editable = true;
      },
    ];
    for (const edit of edits) {
      const { manifest, input, lock } = fixture(definition);
      edit(manifest);
      input.manifest.bytes = Buffer.from(JSON.stringify(manifest));
      lock.manifest.sha256 = sha256(input.manifest.bytes);
      assert.throws(() => verifyPublication(input), /manifest contract mismatch/);
    }
  });

  for (const section of [
    'root',
    'metadata',
    'spec',
    'spec.producer',
    'spec.contract',
    'spec.source',
    'spec.artifact',
  ] as const) {
    test(`${definition.product}: rejects unexpected manifest ${section} fields with matching byte digest`, () => {
      const { manifest, input, lock } = fixture(definition);
      const sections = {
        root: manifest,
        metadata: manifest.metadata,
        spec: manifest.spec,
        'spec.producer': manifest.spec.producer,
        'spec.contract': manifest.spec.contract,
        'spec.source': manifest.spec.source,
        'spec.artifact': manifest.spec.artifact,
      };
      Object.assign(sections[section], { unexpected: 'not allowed by the manifest schema' });
      input.manifest.bytes = Buffer.from(JSON.stringify(manifest));
      lock.manifest.sha256 = sha256(input.manifest.bytes);
      const event = {
        protocol_version: 1,
        product: lock.product,
        producer_repository: lock.producerRepository,
        source_revision: lock.sourceRevision,
        release_tag: lock.releaseTag,
        artifact: lock.artifact,
        manifest: lock.manifest,
        semantic_sha256: lock.semanticSha256,
      };
      const label = section === 'root' ? 'manifest' : `manifest ${section.replace('spec.', '')}`;
      const expected = new RegExp(`^${label} fields mismatch$`);
      assert.throws(() => verifyPublication(input), { message: expected });
      assert.throws(
        () => verifyPublication({ ...input, identity: { kind: 'event', value: event } }),
        { message: expected },
      );
      if (definition.product === 'knowledge-public-v1') {
        const knowledgeLock = parseKnowledgePublicV1Lock(JSON.stringify(lock));
        assert.throws(
          () =>
            verifyKnowledgePublicV1Manifest(knowledgeLock, input.manifest.bytes.toString('utf8')),
          { message: expected },
        );
      }
    });
  }

  test(`${definition.product}: rejects null manifest sections and invalid UTF-8`, () => {
    for (const section of ['producer', 'contract', 'source', 'artifact']) {
      const { manifest, input, lock } = fixture(definition);
      const altered = { ...manifest, spec: { ...manifest.spec, [section]: null } };
      input.manifest.bytes = Buffer.from(JSON.stringify(altered));
      lock.manifest.sha256 = sha256(input.manifest.bytes);
      assert.throws(() => verifyPublication(input), /must be a JSON object/);
    }
    const { input, lock } = fixture(definition);
    input.artifact.bytes = Buffer.from([0xff]);
    lock.artifact.sha256 = sha256(input.artifact.bytes);
    assert.throws(() => verifyPublication(input), /encoded data/);
  });

  test(`${definition.product}: retains owner validation and source binding`, () => {
    for (const change of ['payload', 'revision', 'repository', 'product', 'producer']) {
      const { artifact, input, lock } = fixture(definition);
      const altered = JSON.parse(JSON.stringify(artifact));
      if (change === 'payload') altered.payload = null;
      else if (change === 'revision') altered.source.revision = 'f'.repeat(40);
      else if (change === 'repository')
        altered.source.repository = 'https://github.com/foreign/repo.git';
      else altered[change] = 'wrong';
      input.artifact.bytes = Buffer.from(JSON.stringify(altered));
      lock.artifact.sha256 = sha256(input.artifact.bytes);
      lock.semanticSha256 = semanticSha256(altered);
      if (change === 'revision')
        assert.doesNotThrow(() => definition.parseArtifact(JSON.stringify(altered)));
      else assert.throws(() => definition.parseArtifact(JSON.stringify(altered)));
      assert.throws(() => verifyPublication(input));
    }
  });

  test(`${definition.product}: rejects owner-level unsafe payloads despite valid announced hashes`, () => {
    const { artifact, input, lock } = fixture(definition);
    const altered = JSON.parse(JSON.stringify(artifact));
    switch (definition.product) {
      case 'knowledge-public-v1':
        altered.payload.notes = [
          {
            id: 'private',
            sourcePath: '../secret.md',
            title: 'private',
            markdown: '',
            visibility: 'private',
            aliases: [],
            tags: [],
          },
        ];
        break;
      case 'pds-catalog-v1':
        altered.payload.repositories = [
          { id: 'foreign', domainId: 'missing', relation: 'canonical' },
        ];
        break;
      case 'infra-public-v2':
        altered.payload.connections = [{ from: 'host-missing', to: 'svc-missing', kind: 'hosts' }];
        break;
    }
    input.artifact.bytes = Buffer.from(JSON.stringify(altered));
    lock.artifact.sha256 = sha256(input.artifact.bytes);
    lock.semanticSha256 = semanticSha256(altered);
    assert.throws(() => definition.parseArtifact(JSON.stringify(altered)));
    assert.throws(() => verifyPublication(input));
  });
}
