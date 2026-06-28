/**
 * Asset (media) file copy logic.
 *
 * Copies non-markdown files from vault assets to public directory.
 * Includes collision detection to warn when multiple source files
 * share the same basename (last-wins strategy).
 */

import fs from 'fs';
import path from 'path';
import type { SyncStats } from './types';

export interface MediaCollision {
  basename: string;
  targetPath: string;
  sources: string[];
}

/**
 * Recursively collect all non-markdown files.
 */
export function collectMediaFiles(dir: string): string[] {
  const result: string[] = [];
  if (!fs.existsSync(dir)) return result;

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      result.push(...collectMediaFiles(fullPath));
      continue;
    }

    if (!entry.toLowerCase().endsWith('.md')) {
      result.push(fullPath);
    }
  }

  return result;
}

/**
 * Detect basename collisions among media files.
 * Returns an array of collisions (empty if none).
 */
export function detectMediaCollisions(
  mediaFiles: string[],
  assetsDest: string
): MediaCollision[] {
  const byBasename = new Map<string, string[]>();
  for (const f of mediaFiles) {
    const base = path.basename(f);
    if (!byBasename.has(base)) byBasename.set(base, []);
    byBasename.get(base)!.push(f);
  }

  const collisions: MediaCollision[] = [];
  for (const [base, sources] of byBasename) {
    if (sources.length > 1) {
      collisions.push({
        basename: base,
        targetPath: path.join(assetsDest, base),
        sources,
      });
    }
  }
  return collisions;
}

/**
 * Copy all media files from source to destination (flat copy).
 * Detects and reports basename collisions as warnings.
 */
export function syncAssets(
  mediaSource: string,
  assetsDest: string,
  stats: SyncStats
): void {
  if (!fs.existsSync(mediaSource)) {
    console.log(`  assets dir not found, skipping: ${mediaSource}`);
    return;
  }

  if (!fs.existsSync(assetsDest)) {
    fs.mkdirSync(assetsDest, { recursive: true });
  }

  const files = collectMediaFiles(mediaSource);

  // Detect collisions and warn
  const collisions = detectMediaCollisions(files, assetsDest);
  for (const c of collisions) {
    stats.warnings.push(
      `media collision: ${c.basename} — ${c.sources.length} sources share the same target. ` +
      `Last file copied wins. Sources: ${c.sources.join(', ')}`
    );
  }

  for (const srcPath of files) {
    const file = path.basename(srcPath);
    const destPath = path.join(assetsDest, file);

    try {
      fs.copyFileSync(srcPath, destPath);
      stats.assetsCopied++;
    } catch (err) {
      stats.errors.push(`asset ${file}: ${err}`);
    }
  }
}
