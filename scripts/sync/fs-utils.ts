/**
 * Shared filesystem utilities for the sync pipeline.
 */

import fs from 'fs';
import path from 'path';

/**
 * Recursively collect all files relative to baseDir.
 * Skips dotfiles and dot-directories.
 */
export function collectFiles(dir: string, baseDir: string): Set<string> {
  const result = new Set<string>();
  if (!fs.existsSync(dir)) return result;

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      for (const sub of collectFiles(fullPath, baseDir)) {
        result.add(sub);
      }
    } else {
      result.add(path.relative(baseDir, fullPath));
    }
  }
  return result;
}
