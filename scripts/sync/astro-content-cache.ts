/**
 * Astro keeps content-loader state under `.astro/`.
 *
 * A manual content sync can replace a large number of Markdown files while an
 * older local cache still describes the previous collection. Clearing the
 * cache after a real sync prevents transient duplicate-id diagnostics on the
 * next `astro check`/build. The cache is generated state, so deleting it is
 * always safe.
 */

import fs from 'node:fs';
import path from 'node:path';

export function clearAstroContentCache(projectRoot = process.cwd()): boolean {
  const cacheDir = path.join(projectRoot, '.astro');
  if (!fs.existsSync(cacheDir)) return false;
  fs.rmSync(cacheDir, { recursive: true, force: true });
  return true;
}
