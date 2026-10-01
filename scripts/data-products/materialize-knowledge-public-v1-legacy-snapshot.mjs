import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PUBLICATION_PATHS = ['z', 'assets', 'config', 'blogs'];

function fail(message) {
  throw new Error(`[knowledge-snapshot] ${message}`);
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function assertStringArrayEqual(actual, expected, label) {
  if (
    !Array.isArray(actual) ||
    !Array.isArray(expected) ||
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    fail(`${label} drift`);
  }
}

function assertProducerIndexesMatchProjection(projection, producerRoot) {
  const indexRoot = path.join(producerRoot, 'generated', 'knowledge-index');
  const notesPath = path.join(indexRoot, 'notes-index.json');
  const assetsPath = path.join(indexRoot, 'asset-index.json');
  for (const required of [notesPath, assetsPath, path.join(indexRoot, 'link-graph.json')]) {
    if (!fs.existsSync(required)) fail(`missing producer index: ${required}`);
  }

  const upstreamNotes = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
  const upstreamAssets = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
  if (!Array.isArray(upstreamNotes) || !Array.isArray(upstreamAssets)) {
    fail('producer knowledge indexes have an unexpected shape');
  }

  const projectionByPath = new Map(
    projection.payload.notes.map(note => [String(note.sourcePath).replaceAll('\\\\', '/'), note]),
  );
  let publicNotes = 0;
  let restrictedNotes = 0;
  for (const note of upstreamNotes) {
    const sourcePath = String(note.sourcePath ?? '').replaceAll('\\\\', '/');
    const projected = projectionByPath.get(sourcePath);
    if (note.visibility === 'public') {
      publicNotes += 1;
      if (!projected) fail(`${sourcePath}: public upstream note missing from projection`);
      if (projected.visibility !== 'public') fail(`${sourcePath}: public projection visibility drift`);
      if (projected.title !== note.title) fail(`${sourcePath}: title drift`);
      assertStringArrayEqual(projected.tags, note.tags, `${sourcePath}: tags`);
      assertStringArrayEqual(projected.aliases, note.aliases, `${sourcePath}: aliases`);
    } else {
      restrictedNotes += 1;
      if (projected) fail(`${sourcePath}: restricted upstream note leaked into projection`);
    }
  }

  const projectionAssetIds = new Set(projection.payload.assets.map(asset => asset.assetId));
  let publicAssets = 0;
  for (const asset of upstreamAssets) {
    const assetId = String(asset.assetId ?? '');
    if (!assetId) continue;
    if (asset.visibility === 'public') {
      publicAssets += 1;
      if (!projectionAssetIds.has(assetId)) fail(`${assetId}: public upstream asset missing from projection`);
    } else if (projectionAssetIds.has(assetId)) {
      fail(`${assetId}: restricted upstream asset leaked into projection`);
    }
  }

  return { publicNotes, publicAssets, restrictedNotes };
}

function archiveRevision(repo, revision, destination, archivePath) {
  fs.mkdirSync(destination, { recursive: true });
  execFileSync('git', ['-C', repo, 'archive', '--format=tar', '-o', archivePath, revision], {
    stdio: 'inherit',
  });
  execFileSync('tar', ['-xf', archivePath, '-C', destination], { stdio: 'inherit' });
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited with ${result.status}`);
}

export function materializeExactSourceLegacySnapshot({
  artifactPath,
  producerRoot,
  digitalBiomeRoot = process.cwd(),
  outputRoot,
}) {
  const resolvedArtifact = path.resolve(artifactPath);
  const resolvedProducer = path.resolve(producerRoot);
  const resolvedDigitalBiome = path.resolve(digitalBiomeRoot);

  const projection = JSON.parse(fs.readFileSync(resolvedArtifact, 'utf8'));
  if (
    projection?.schemaVersion !== 1 ||
    projection?.product !== 'knowledge-public-v1' ||
    projection?.generated !== true ||
    projection?.editable !== false ||
    typeof projection?.source?.revision !== 'string' ||
    !/^[0-9a-f]{40}$/.test(projection.source.revision) ||
    !Array.isArray(projection?.payload?.notes) ||
    !Array.isArray(projection?.payload?.assets)
  ) {
    fail('knowledge-public-v1 artifact envelope is invalid');
  }

  const sourceRevision = projection.source.revision;
  const producerHead = git(resolvedProducer, ['rev-parse', 'HEAD']);
  git(resolvedProducer, ['cat-file', '-e', `${sourceRevision}^{commit}`]);

  const changedPublicationPaths = git(resolvedProducer, [
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    sourceRevision,
    producerHead,
    '--',
    ...PUBLICATION_PATHS,
  ]);
  if (changedPublicationPaths) {
    fail(
      `producer publication paths changed after projection source revision:\n${changedPublicationPaths}`,
    );
  }

  const producerAlignment = assertProducerIndexesMatchProjection(projection, resolvedProducer);
  const digitalBiomeRevision = git(resolvedDigitalBiome, ['rev-parse', 'HEAD']);

  const root = outputRoot
    ? path.resolve(outputRoot)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'pds-knowledge-exact-source-'));
  if (fs.existsSync(root) && fs.readdirSync(root).length > 0) {
    fail(`output root must be empty: ${root}`);
  }
  fs.mkdirSync(root, { recursive: true });

  const digitalBiomeSnapshot = path.join(root, 'digital-biome');
  const thoughtForestSnapshot = path.join(root, 'thought-forest');
  const digitalBiomeTar = path.join(root, 'digital-biome.tar');
  const thoughtForestTar = path.join(root, 'thought-forest.tar');

  archiveRevision(resolvedDigitalBiome, digitalBiomeRevision, digitalBiomeSnapshot, digitalBiomeTar);
  archiveRevision(resolvedProducer, sourceRevision, thoughtForestSnapshot, thoughtForestTar);
  fs.unlinkSync(digitalBiomeTar);
  fs.unlinkSync(thoughtForestTar);

  const producerIndexRoot = path.join(resolvedProducer, 'generated', 'knowledge-index');
  const snapshotIndexRoot = path.join(thoughtForestSnapshot, 'generated', 'knowledge-index');
  fs.mkdirSync(snapshotIndexRoot, { recursive: true });
  for (const name of ['notes-index.json', 'asset-index.json', 'link-graph.json', 'tag-index.json']) {
    const source = path.join(producerIndexRoot, name);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(snapshotIndexRoot, name));
  }

  const pnpm = process.env.PNPM_BIN?.trim() || 'pnpm';
  run(
    pnpm,
    ['install', '--frozen-lockfile', '--ignore-scripts', '--prefer-offline'],
    digitalBiomeSnapshot,
  );
  run(
    pnpm,
    ['sync:content'],
    digitalBiomeSnapshot,
    {
      ...process.env,
      NOTES_VAULT_ROOT: thoughtForestSnapshot,
      NOTES_UPSTREAM_GENERATED: path.join(thoughtForestSnapshot, 'generated'),
    },
  );

  const indexHashes = {};
  for (const name of ['notes-index.json', 'asset-index.json', 'link-graph.json']) {
    indexHashes[name] = sha256File(path.join(snapshotIndexRoot, name));
  }

  const manifest = {
    schemaVersion: 1,
    product: 'knowledge-public-v1-legacy-snapshot',
    sourceRevision,
    digitalBiomeRevision,
    producerHead,
    artifactSha256: sha256File(resolvedArtifact),
    producerIndexSha256: indexHashes,
    producerAlignment,
  };
  fs.writeFileSync(
    path.join(digitalBiomeSnapshot, '.pds-data-product-snapshot.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  return {
    root,
    legacyRoot: digitalBiomeSnapshot,
    sourceRevision,
    digitalBiomeRevision,
    producerHead,
    producerAlignment,
  };
}

function cli() {
  const artifactPath = process.argv[2]?.trim();
  const producerRoot = process.argv[3]?.trim();
  const outputRoot = process.argv[4]?.trim();
  if (!artifactPath || !producerRoot) {
    fail(
      'usage: node scripts/data-products/materialize-knowledge-public-v1-legacy-snapshot.mjs <knowledge-public-v1.json> <thought-forest-producer-root> [output-root]',
    );
  }
  const result = materializeExactSourceLegacySnapshot({
    artifactPath,
    producerRoot,
    outputRoot,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) cli();
