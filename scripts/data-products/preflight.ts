import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePublicDataProductLock, type PublicDataProductLock } from './lock-v1';
import { publicDataProducts } from './registry';
import { sha256 } from './semantic-digest';
import { verifyPublication } from './verify-publication';

export type CacheState =
  | 'ready'
  | 'missing'
  | 'stale'
  | 'invalid-lock'
  | 'invalid-publication'
  | 'unreadable';
export type AssetState = 'matched' | 'missing' | 'stale' | 'unreadable';

export interface PreflightFile {
  kind: 'artifact' | 'manifest';
  file: string;
  state: AssetState;
  expected: string;
  observed?: string;
}

export interface PreflightResult {
  product: string;
  lockPath: string;
  state: CacheState;
  files: PreflightFile[];
}

function readLocalAsset(
  root: string,
  relativePath: string,
  kind: PreflightFile['kind'],
  expected: string,
) {
  try {
    const bytes = fs.readFileSync(path.join(root, relativePath));
    const observed = sha256(bytes);
    const state: AssetState = observed === expected ? 'matched' : 'stale';
    return { check: { kind, file: relativePath, state, expected, observed }, bytes };
  } catch (error) {
    const state: AssetState =
      (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unreadable';
    return { check: { kind, file: relativePath, state, expected }, bytes: null };
  }
}

/**
 * Read-only, offline, exact committed-lock cache preflight.
 *
 * This never writes the workspace, updates a lock, selects a newer Release, or
 * reads a private producer checkout. The existing verifyPublication remains
 * the authoritative local artifact/manifest/schema/semantic validator.
 * Provenance (exact GitHub Release/tag) stays enforced by the materializer.
 */
export function inspectLocalPublicDataProducts(root = process.cwd()): PreflightResult[] {
  return publicDataProducts
    .filter((definition) => definition.genericConsumption)
    .map((definition) => {
      const { product, lockPath } = definition;
      let lock: PublicDataProductLock;
      try {
        lock = parsePublicDataProductLock(
          JSON.parse(fs.readFileSync(path.join(root, lockPath), 'utf8')),
        );
        if (lock.product !== product) throw new Error('Committed lock product mismatch');
      } catch {
        return { product, lockPath, state: 'invalid-lock', files: [] };
      }

      const checks = (['artifact', 'manifest'] as const).map((kind) =>
        readLocalAsset(
          root,
          path.posix.join('.pds-runtime', product, lock[kind].name),
          kind,
          lock[kind].sha256,
        ),
      );
      const files = checks.map(({ check }) => check);

      if (files.some((file) => file.state === 'unreadable'))
        return { product, lockPath, state: 'unreadable', files };
      if (files.some((file) => file.state === 'missing'))
        return { product, lockPath, state: 'missing', files };
      if (files.some((file) => file.state === 'stale'))
        return { product, lockPath, state: 'stale', files };

      // Matching SHA-256 is necessary, not sufficient: validate contracts and
      // semantic SHA using the original fail-closed publication validator.
      try {
        const artifact = checks[0].bytes;
        const manifest = checks[1].bytes;
        if (!artifact || !manifest) throw new Error('Missing verified bytes');
        verifyPublication({
          identity: { kind: 'lock', value: lock },
          tag: {
            producerRepository: lock.producerRepository,
            releaseTag: lock.releaseTag,
            sourceRevision: lock.sourceRevision,
          },
          artifact: { name: lock.artifact.name, bytes: artifact },
          manifest: { name: lock.manifest.name, bytes: manifest },
        });
      } catch {
        return { product, lockPath, state: 'invalid-publication', files };
      }
      return { product, lockPath, state: 'ready', files };
    });
}

/** Output includes only product names, filenames and public SHA-256 digests. */
export function formatPreflightDiagnostics(results: readonly PreflightResult[]): string {
  const ready = results.every((item) => item.state === 'ready');
  const lines = [
    ready ? 'preflight:data-products=PASS' : 'preflight:data-products=FAIL (read-only)',
  ];

  for (const result of results) {
    if (result.state === 'ready') {
      lines.push('  PASS ' + result.product + ': exact committed ' + result.lockPath);
      continue;
    }
    const message: Record<Exclude<CacheState, 'ready'>, string> = {
      missing: 'cache missing',
      stale: 'stale cache / SHA-256 mismatch',
      'invalid-lock': 'invalid committed lock (not a recoverable cache mismatch)',
      'invalid-publication': 'publication integrity failed despite matching file digests',
      unreadable: 'cache unreadable',
    };
    lines.push(
      '  FAIL ' + result.product + ': ' + message[result.state] + ' vs ' + result.lockPath,
    );
    for (const file of result.files.filter((check) => check.state !== 'matched')) {
      lines.push(
        '    ' +
          file.kind +
          ' ' +
          file.file +
          ': ' +
          file.state +
          '; expected=' +
          file.expected +
          (file.observed ? ' observed=' + file.observed : ''),
      );
    }
  }

  if (!ready) {
    lines.push('Recovery for missing/stale caches: pnpm sync:data-products');
    lines.push(
      'This fetches the exact committed Release only. It does not edit locks; if a lock or publication is invalid, stop and investigate the pinned identity.',
    );
    lines.push('Never bypass SHA-256, switch to latest, or delete local producer/user data.');
  }
  return lines.join('\n');
}

function main(): void {
  if (process.argv.slice(2).length) {
    console.error('usage: pnpm preflight:data-products');
    process.exitCode = 2;
    return;
  }
  const results = inspectLocalPublicDataProducts();
  const report = formatPreflightDiagnostics(results);
  if (results.some((item) => item.state !== 'ready')) {
    console.error(report);
    process.exitCode = 1;
  } else {
    console.log(report);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
