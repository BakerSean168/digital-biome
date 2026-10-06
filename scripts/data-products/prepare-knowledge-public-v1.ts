import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublicDataProductRelease } from './fetch-release';
import {
  createGitHubReleaseTransport,
  githubReadToken,
  type GitHubReleaseTransport,
} from './github-release-transport';
import {
  parseKnowledgePublicV1Lock,
  verifyKnowledgePublicV1Artifact,
  verifyKnowledgePublicV1Manifest,
} from './knowledge-public-v1-lock';
import { materializeKnowledgePublicV1Source } from './knowledge-public-v1';
import { syncKnowledgeSource } from './sync-knowledge-public-v1';

/** Single-writer prepare. All verification (including embedded media) precedes replacement. */
export async function prepareKnowledgePublicV1(
  lockRaw: string,
  runtimeRoot: string,
  transport: GitHubReleaseTransport,
  fetchOnly = false,
) {
  const lock = parseKnowledgePublicV1Lock(lockRaw);
  const publication = await readPublicDataProductRelease(
    { product: lock.product, releaseTag: lock.releaseTag, identity: lock },
    transport,
  );
  const projection = verifyKnowledgePublicV1Artifact(
    lock,
    publication.artifact.bytes.toString('utf8'),
  );
  verifyKnowledgePublicV1Manifest(lock, publication.manifest.bytes.toString('utf8'));
  const target = path.resolve(runtimeRoot);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const workspace = fs.mkdtempSync(path.join(path.dirname(target), '.knowledge-prepare-'));
  const stage = path.join(workspace, 'next');
  const backup = path.join(workspace, 'previous');
  let preserveBackup = false;
  try {
    fs.mkdirSync(stage);
    fs.writeFileSync(path.join(stage, lock.artifact.name), publication.artifact.bytes);
    fs.writeFileSync(path.join(stage, lock.manifest.name), publication.manifest.bytes);
    if (!fetchOnly) {
      const materialized = materializeKnowledgePublicV1Source(
        projection,
        path.join(stage, 'source'),
      );
      if (materialized.sourceRevision !== lock.sourceRevision)
        throw new Error('Materialized knowledge source revision mismatch');
    }
    // Same filesystem, synchronous rename with rollback. No await/sync/network in this boundary.
    const existed = fs.existsSync(target);
    if (existed) fs.renameSync(target, backup);
    try {
      fs.renameSync(stage, target);
    } catch (error) {
      if (existed) {
        try {
          fs.renameSync(backup, target);
        } catch (restoreError) {
          preserveBackup = true;
          throw new AggregateError(
            [error, restoreError],
            `Restore failed; accepted data retained at ${backup}`,
          );
        }
      }
      throw error;
    }
  } finally {
    if (!preserveBackup) fs.rmSync(workspace, { recursive: true, force: true });
  }
  return { sourceRoot: path.join(target, 'source'), identity: publication.identity };
}

async function main() {
  const [runtimeRoot, lockPath, ...flags] = process.argv.slice(2);
  if (
    !runtimeRoot ||
    !lockPath ||
    flags.some((f) => !['--fetch-only', '--dry-run', '--with-favicons'].includes(f))
  )
    throw new Error(
      'usage: prepare-knowledge-public-v1.ts <runtime-root> <lock-path> [--fetch-only|--dry-run|--with-favicons]',
    );
  const fetchOnly = flags.includes('--fetch-only');
  const prepared = await prepareKnowledgePublicV1(
    fs.readFileSync(lockPath, 'utf8'),
    runtimeRoot,
    createGitHubReleaseTransport(githubReadToken()),
    fetchOnly,
  );
  if (!fetchOnly)
    await syncKnowledgeSource(
      prepared.sourceRoot,
      flags.includes('--dry-run'),
      flags.includes('--with-favicons'),
    );
  console.log(
    `knowledge-public-v1 prepare=PASS revision=${prepared.identity.sourceRevision} source=${prepared.sourceRoot}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
