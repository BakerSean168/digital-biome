/**
 * Sync report — prints summary of sync operation.
 *
 * @returns number of errors (0 = success)
 */

import type { SyncStats } from './types';

export function printSyncReport(stats: SyncStats): number {
  console.log(
    `\nDone: ${stats.copied} notes copied, ${stats.assetsCopied} assets copied, ` +
    `${stats.faviconsCached} favicons cached, ${stats.cleaned} cleaned, ${stats.skipped} skipped`
  );

  if (stats.warnings.length > 0) {
    console.warn(`\nWarnings (${stats.warnings.length}):`);
    stats.warnings.forEach(w => console.warn(`  ⚠ ${w}`));
  }

  if (stats.errors.length > 0) {
    console.error(`\nErrors (${stats.errors.length}):`);
    stats.errors.forEach(err => console.error(`  ✖ ${err}`));
  }

  return stats.errors.length;
}

export function createStats(): SyncStats {
  return {
    copied: 0,
    cleaned: 0,
    skipped: 0,
    assetsCopied: 0,
    faviconsCached: 0,
    warnings: [],
    errors: [],
  };
}
