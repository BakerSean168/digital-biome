import fs from 'node:fs';
import path from 'node:path';
import {
  parseInfraPublicV2Lock,
  verifyInfraPublicV2Artifact,
  verifyInfraPublicV2Manifest,
} from './infra-public-v2-lock';

function resolvePath(index: number, fallback: string): string {
  return path.resolve(process.argv[index] ?? fallback);
}

const lockPath = resolvePath(2, 'data-products/infra-public-v2.lock.json');
const artifactPath = resolvePath(3, '.pds-runtime/infra-public-v2/infra-public-v2.json');
const manifestPath = resolvePath(4, '.pds-runtime/infra-public-v2/infra-public-v2.manifest.json');

try {
  const lock = parseInfraPublicV2Lock(fs.readFileSync(lockPath, 'utf8'));
  const projection = verifyInfraPublicV2Artifact(lock, fs.readFileSync(artifactPath, 'utf8'));
  verifyInfraPublicV2Manifest(lock, fs.readFileSync(manifestPath, 'utf8'));

  console.log(
    `infra-public-v2 lock=PASS revision=${projection.source.revision} release=${lock.releaseTag} resources=${projection.payload.summary.resourceCount}`,
  );
} catch (error) {
  console.error(error);
  process.exit(1);
}
