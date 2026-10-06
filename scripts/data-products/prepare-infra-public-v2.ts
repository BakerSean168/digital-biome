import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublicDataProductRelease } from './fetch-release';
import {
  createGitHubReleaseTransport,
  githubReadToken,
  type GitHubReleaseTransport,
} from './github-release-transport';
import { parseInfraPublicV2Lock } from './infra-public-v2-lock';
import { materializeInfraPublicV2 } from './materialize-infra-public-v2';

/** Single-writer prepare: no producer checkout/exporter or private RuntimeBinding reads. */
export async function prepareInfraPublicV2(
  lockRaw: string,
  runtimeRoot: string,
  transport: GitHubReleaseTransport,
  outputPath: string | false = 'src/data/infrastructure/infra-public-v2.json',
) {
  const lock = parseInfraPublicV2Lock(lockRaw);
  const publication = await readPublicDataProductRelease(
    { product: lock.product, releaseTag: lock.releaseTag, identity: lock },
    transport,
  );
  const target = path.resolve(runtimeRoot);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const workspace = fs.mkdtempSync(path.join(path.dirname(target), '.infra-prepare-'));
  const stage = path.join(workspace, 'next');
  const backup = path.join(workspace, 'previous');
  let preserveBackup = false;
  try {
    fs.mkdirSync(stage);
    fs.writeFileSync(path.join(stage, lock.artifact.name), publication.artifact.bytes);
    fs.writeFileSync(path.join(stage, lock.manifest.name), publication.manifest.bytes);
    const existed = fs.existsSync(target);
    if (existed) fs.renameSync(target, backup);
    let installed = false;
    try {
      fs.renameSync(stage, target);
      installed = true;
      if (outputPath !== false)
        materializeInfraPublicV2(publication.artifact.bytes.toString('utf8'), outputPath);
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
    if (!preserveBackup) fs.rmSync(workspace, { recursive: true, force: true });
  }
  return { identity: publication.identity };
}

async function main() {
  const [runtimeRoot, lockPath, ...flags] = process.argv.slice(2);
  if (!runtimeRoot || !lockPath || flags.some((flag) => flag !== '--fetch-only'))
    throw new Error('usage: prepare-infra-public-v2.ts <runtime-root> <lock-path> [--fetch-only]');
  const result = await prepareInfraPublicV2(
    fs.readFileSync(lockPath, 'utf8'),
    runtimeRoot,
    createGitHubReleaseTransport(githubReadToken()),
    flags.includes('--fetch-only')
      ? false
      : process.env.INFRA_PUBLIC_V2_OUTPUT?.trim() || undefined,
  );
  console.log(
    `infra-public-v2 prepare=PASS revision=${result.identity.sourceRevision} release=${result.identity.releaseTag}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
