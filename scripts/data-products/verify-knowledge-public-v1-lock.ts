import fs from 'node:fs';
import path from 'node:path';
import {
  parseKnowledgePublicV1Lock,
  verifyKnowledgePublicV1Artifact,
  verifyKnowledgePublicV1Manifest,
} from './knowledge-public-v1-lock';

function resolvePath(index: number, fallback: string): string {
  return path.resolve(process.argv[index] ?? fallback);
}

const lockPath = resolvePath(2, 'data-products/knowledge-public-v1.lock.json');
const artifactPath = resolvePath(3, '.pds-runtime/knowledge-public-v1/knowledge-public-v1.json');
const manifestPath = resolvePath(
  4,
  '.pds-runtime/knowledge-public-v1/knowledge-public-v1.manifest.json',
);

try {
  const lock = parseKnowledgePublicV1Lock(fs.readFileSync(lockPath, 'utf8'));
  const artifactRaw = fs.readFileSync(artifactPath, 'utf8');
  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  const projection = verifyKnowledgePublicV1Artifact(lock, artifactRaw);
  verifyKnowledgePublicV1Manifest(lock, manifestRaw);

  console.log(
    `knowledge-public-v1 lock=PASS revision=${projection.source.revision} release=${lock.releaseTag} artifact=${lock.artifact.sha256}`,
  );
} catch (error) {
  console.error(error);
  process.exit(1);
}
