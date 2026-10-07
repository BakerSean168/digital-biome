import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublicDataProductRelease } from './fetch-release';
import {
  createGitHubReleaseTransport,
  githubReadToken,
  type GitHubReleaseTransport,
} from './github-release-transport';
import { parsePdsCatalogV1Lock } from './pds-catalog-v1-lock';

/** PDS adapter: retain verified bytes, existing JSON imports and domain semantics. */
export async function preparePdsCatalogV1(
  lockRaw: string,
  runtimeRoot: string,
  transport: GitHubReleaseTransport,
  outputPath = 'src/data/system/pds-catalog-v1.json',
) {
  const lock = parsePdsCatalogV1Lock(lockRaw);
  // The registry's existing parsePdsCatalogV1 owns domain validation here.
  const publication = await readPublicDataProductRelease(
    { product: lock.product, releaseTag: lock.releaseTag, identity: lock },
    transport,
  );
  const target = path.resolve(runtimeRoot);
  const output = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const workspace = fs.mkdtempSync(path.join(path.dirname(target), '.pds-prepare-'));
  const stage = path.join(workspace, 'next');
  const backup = path.join(workspace, 'previous');
  let outputStage: string | undefined;
  let preserveBackup = false;
  try {
    fs.mkdirSync(stage);
    fs.writeFileSync(path.join(stage, lock.artifact.name), publication.artifact.bytes);
    fs.writeFileSync(path.join(stage, lock.manifest.name), publication.manifest.bytes);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    outputStage = fs.mkdtempSync(path.join(path.dirname(output), '.pds-output-'));
    const nextOutput = path.join(outputStage, 'next.json');
    fs.writeFileSync(nextOutput, publication.artifact.bytes, { flag: 'wx' });
    // Single writer, same-filesystem renames. All verification/staging precedes swap.
    const existed = fs.existsSync(target);
    if (existed) fs.renameSync(target, backup);
    let installed = false;
    try {
      fs.renameSync(stage, target);
      installed = true;
      fs.renameSync(nextOutput, output);
    } catch (error) {
      try {
        if (installed) fs.rmSync(target, { recursive: true, force: true });
        if (existed) fs.renameSync(backup, target);
      } catch (restoreError) {
        preserveBackup = true;
        throw new AggregateError(
          [error, restoreError],
          `Restore failed; accepted data retained at ${backup}`,
        );
      }
      throw error;
    }
  } finally {
    if (outputStage) fs.rmSync(outputStage, { recursive: true, force: true });
    if (!preserveBackup) fs.rmSync(workspace, { recursive: true, force: true });
  }
  return { identity: publication.identity };
}

async function main() {
  const [
    runtimeRoot = '.pds-runtime/pds-catalog-v1',
    lockPath = 'data-products/pds-catalog-v1.lock.json',
    ...extra
  ] = process.argv.slice(2);
  if (extra.length) throw new Error('usage: prepare-pds-catalog-v1.ts [runtime-root lock-path]');
  const result = await preparePdsCatalogV1(
    fs.readFileSync(lockPath, 'utf8'),
    runtimeRoot,
    createGitHubReleaseTransport(githubReadToken()),
  );
  console.log(
    `pds-catalog-v1 prepare=PASS revision=${result.identity.sourceRevision} release=${result.identity.releaseTag}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
