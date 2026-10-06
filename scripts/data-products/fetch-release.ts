import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertRecord, parsePublicDataProductLock } from './lock-v1';
import { publicDataProducts } from './registry';
import { semanticSha256, sha256 } from './semantic-digest';
import { verifyPublication } from './verify-publication';
import type { GitHubReleaseTransport } from './github-release-transport';

const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_RELEASE_PAGES = 20;

export function releaseSourceRevision(product: string, tag: unknown): string {
  if (typeof tag !== 'string' || !tag.startsWith(`${product}-`))
    throw new Error('Invalid exact product Release tag');
  const revision = tag.slice(product.length + 1);
  if (!/^[0-9a-f]{40}$/.test(revision) || revision.length !== 40)
    throw new Error('Invalid exact product Release tag');
  return revision;
}

function publishedAt(release: Record<string, unknown>): number {
  if (
    release.draft !== false ||
    typeof release.published_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(release.published_at) ||
    !Number.isFinite(Date.parse(release.published_at)) ||
    new Date(release.published_at).toISOString() !== release.published_at.replace('Z', '.000Z')
  )
    throw new Error('Release must be non-draft and published');
  return Date.parse(release.published_at);
}

function positiveId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    throw new Error('Invalid GitHub object ID');
  return value;
}

async function latestTag(
  base: string,
  product: string,
  transport: GitHubReleaseTransport,
): Promise<string> {
  let latest: { tag: string; time: number } | undefined;
  for (let page = 1; page <= MAX_RELEASE_PAGES; page++) {
    const releases = await transport.json(`${base}/releases?per_page=100&page=${page}`);
    if (!Array.isArray(releases) || releases.length > 100) throw new Error('Invalid Release list');
    for (const release of releases) {
      assertRecord(release, 'Release');
      if (typeof release.tag_name !== 'string') throw new Error('Invalid Release tag');
      if (!release.tag_name.startsWith(`${product}-`) || release.draft === true) continue;
      // A broken publication in this product namespace must not hide behind an older one.
      const time = publishedAt(release);
      if (!latest || time > latest.time) latest = { tag: release.tag_name, time };
      else if (time === latest.time && release.tag_name !== latest.tag)
        throw new Error('Ambiguous latest product Release publication time');
    }
    if (releases.length < 100) {
      if (!latest) throw new Error(`No published Release for ${product}`);
      releaseSourceRevision(product, latest.tag);
      return latest.tag;
    }
  }
  throw new Error('Release enumeration limit exceeded; refusing a partial latest result');
}

async function resolveTag(
  base: string,
  tag: string,
  transport: GitHubReleaseTransport,
): Promise<string> {
  const ref = await transport.json(`${base}/git/ref/tags/${tag}`);
  assertRecord(ref, 'Git tag ref');
  if (ref.ref !== `refs/tags/${tag}`) throw new Error('Git tag ref mismatch');
  let object = ref.object;
  for (let depth = 0; depth < 8; depth++) {
    assertRecord(object, 'Git tag object');
    if (
      typeof object.sha !== 'string' ||
      !/^[0-9a-f]{40}$/.test(object.sha) ||
      object.sha.length !== 40
    )
      throw new Error('Invalid Git tag object SHA');
    if (object.type === 'commit') return object.sha;
    if (object.type !== 'tag') throw new Error('Git tag must resolve to a commit');
    const annotated = await transport.json(`${base}/git/tags/${object.sha}`);
    assertRecord(annotated, 'Annotated Git tag');
    if (annotated.sha !== object.sha) throw new Error('Annotated Git tag SHA mismatch');
    object = annotated.object;
  }
  throw new Error('Git tag dereference limit exceeded');
}

/** Exact tag or publication-time reconciliation. Never reads producer main/source. */
export async function readPublicDataProductRelease(
  request: { product: unknown; releaseTag?: unknown; identity?: unknown },
  transport: GitHubReleaseTransport,
  tempRoot = os.tmpdir(),
) {
  const definition = publicDataProducts.find((d) => d.product === request.product);
  if (!definition) throw new Error('Unknown public product');
  const expected =
    request.identity === undefined ? undefined : parsePublicDataProductLock(request.identity);
  if (
    expected &&
    (expected.product !== definition.product || request.releaseTag !== expected.releaseTag)
  )
    throw new Error('Requested Release identity mismatch');
  const base = `/repos/${definition.producerRepository}`;
  const tag =
    request.releaseTag === undefined
      ? await latestTag(base, definition.product, transport)
      : request.releaseTag;
  const revision = releaseSourceRevision(definition.product, tag);
  // Validation above guarantees tag is a safe, exact API path segment.
  const releaseTag = `${definition.product}-${revision}`;
  const release = await transport.json(`${base}/releases/tags/${releaseTag}`);
  assertRecord(release, 'Release');
  publishedAt(release);
  const releaseId = positiveId(release.id);
  if (release.tag_name !== releaseTag) throw new Error('Release tag mismatch');
  const sourceRevision = await resolveTag(base, releaseTag, transport);
  if (sourceRevision !== revision) throw new Error('Release tag target mismatch');
  if (!Array.isArray(release.assets) || release.assets.length !== 2)
    throw new Error('Release publication assets mismatch: expected exactly artifact and manifest');
  const assets = release.assets.map((asset: unknown) => {
    assertRecord(asset, 'Release asset');
    return asset;
  });
  if (new Set(assets.map((a) => positiveId(a.id))).size !== 2)
    throw new Error('Duplicate Release asset ID');
  const staging = fs.mkdtempSync(path.join(tempRoot, 'pds-release-'));
  try {
    async function download(name: string, maxBytes: number) {
      const matches = assets.filter((a) => a.name === name);
      if (matches.length !== 1)
        throw new Error(`Release publication asset missing/duplicate: ${name}`);
      const asset = matches[0];
      if (asset.state !== 'uploaded') throw new Error('Release asset is not fully uploaded');
      if (
        typeof asset.size !== 'number' ||
        !Number.isSafeInteger(asset.size) ||
        asset.size <= 0 ||
        asset.size > maxBytes
      )
        throw new Error('Release asset size exceeds bounds');
      const bytes = await transport.download(
        `${base}/releases/assets/${positiveId(asset.id)}`,
        maxBytes,
      );
      if (bytes.length !== asset.size || bytes.length > maxBytes)
        throw new Error('Release asset size mismatch');
      if (asset.digest !== undefined && asset.digest !== null && asset.digest !== sha256(bytes))
        throw new Error('Release asset metadata digest mismatch');
      const file = path.join(staging, name);
      fs.writeFileSync(file, bytes, { flag: 'wx' });
      return { name, bytes: fs.readFileSync(file) };
    }
    const artifact = await download(definition.artifactName, MAX_ARTIFACT_BYTES);
    const manifest = await download(definition.manifestName, MAX_MANIFEST_BYTES);
    const identity =
      expected ??
      parsePublicDataProductLock({
        protocolVersion: 1,
        product: definition.product,
        producerRepository: definition.producerRepository,
        sourceRevision,
        releaseTag,
        artifact: { name: artifact.name, sha256: sha256(artifact.bytes) },
        manifest: { name: manifest.name, sha256: sha256(manifest.bytes) },
        semanticSha256: semanticSha256(
          JSON.parse(
            new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(artifact.bytes),
          ),
        ),
      });
    const verified = verifyPublication({
      identity: { kind: 'lock', value: identity },
      tag: { producerRepository: definition.producerRepository, releaseTag, sourceRevision },
      artifact,
      manifest,
    });
    return { ...verified, artifact, manifest, releaseId, publishedAt: release.published_at };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
