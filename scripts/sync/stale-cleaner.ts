/**
 * Stale file cleanup — removes files from destination that no longer
 * exist in the source vault.
 */

import fs from 'fs';
import path from 'path';
import { collectFiles } from './fs-utils';
import type { SyncStats } from './types';

/**
 * Remove empty directories recursively.
 */
function removeEmptyDirs(dir: string): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (!fs.existsSync(fullPath)) continue;

    if (fs.statSync(fullPath).isDirectory()) {
      removeEmptyDirs(fullPath);
      if (!fs.existsSync(fullPath)) continue;
      if (fs.readdirSync(fullPath).length === 0) {
        fs.rmdirSync(fullPath);
      }
    }
  }
}

/**
 * Delete .md files in destDir that are not in expectedFiles.
 * Also cleans up resulting empty directories.
 */
export function cleanStaleFiles(
  destDir: string,
  expectedFiles: Set<string>,
  stats: SyncStats
): void {
  if (!fs.existsSync(destDir)) return;

  const destFiles = collectFiles(destDir, destDir);

  for (const relPath of destFiles) {
    if (!relPath.endsWith('.md')) continue;

    const fullDestPath = path.join(destDir, relPath);
    if (!expectedFiles.has(relPath)) {
      try {
        fs.unlinkSync(fullDestPath);
        stats.cleaned++;
        console.log(`  cleaned: ${relPath}`);
      } catch (err) {
        stats.errors.push(`clean ${relPath}: ${err}`);
      }
    }
  }

  removeEmptyDirs(destDir);
}
