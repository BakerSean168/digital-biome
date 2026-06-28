/**
 * Sync pipeline orchestrator.
 *
 * Coordinates the full sync process:
 *   1. Check submodule status
 *   2. Copy media assets
 *   3. Collect expected files
 *   4. Clean stale files
 *   5. Sync markdown files (with content processing)
 *   6. Print report
 */

import path from 'node:path';
import { notesConfig } from '../../notes.config';
import { buildSourceLayout } from './config';
import { warnIfVaultSubmoduleOutOfSync, collectExpectedFiles, syncFiles, validateSourceFiles } from './source-adapter';
import { syncAssets, detectMediaCollisions, collectMediaFiles } from './asset-transform';
import { cleanStaleFiles } from './stale-cleaner';
import { createStats, printSyncReport } from './sync-report';
import { buildIndexes } from './build-indexes';
import { mergeAssetIndex } from './merge-asset-index';
import { copyUpstreamLinkGraph } from './copy-upstream-indexes';

export interface RunSyncOptions {
  /** Enable favicon caching (default: false) */
  withFavicons?: boolean;
  /** Dry-run mode — print plan without executing (default: false) */
  dryRun?: boolean;
}

export async function runSync(options: RunSyncOptions = {}): Promise<number> {
  const { withFavicons = false, dryRun = false } = options;

  const layout = buildSourceLayout(notesConfig);

  console.log('Syncing Obsidian notes...');
  console.log(`  notes : ${layout.notesSource} -> ${layout.notesDest}`);
  console.log(`  assets: ${layout.assetNotesSource} -> ${layout.assetNotesDest}`);
  if (layout.configSource) console.log(`  config: ${layout.configSource} -> ${layout.configDest}`);
  console.log(`  media : ${layout.mediaSource} -> ${layout.assetsDest}`);
  if (withFavicons) console.log('  favicons: enabled');
  console.log('');

  const stats = createStats();

  warnIfVaultSubmoduleOutOfSync(layout.vaultRoot, stats);

  // Collect expected files for stale detection
  const expectedFiles = collectExpectedFiles(layout);

  if (dryRun) {
    // Count existing files in destination for stale detection
    const fs = await import('fs');
    const path = await import('path');
    const { collectFiles } = await import('./fs-utils');

    const existingDest = fs.existsSync(layout.notesDest)
      ? Array.from(collectFiles(layout.notesDest, layout.notesDest)).filter(f => f.endsWith('.md'))
      : [];
    const staleFiles = existingDest.filter(f => !expectedFiles.has(f));

    // Count media files and detect collisions (shared logic)
    const mediaFiles = collectMediaFiles(layout.mediaSource);
    const collisions = detectMediaCollisions(mediaFiles, layout.assetsDest);
    const validationSummary = {
      markdownFiles: 0,
      yamlRiskCount: 0,
      assetSchemaRiskCount: 0,
    };

    await validateSourceFiles(layout.notesSource, layout.notesDest, layout, withFavicons, stats, validationSummary);
    await validateSourceFiles(layout.assetNotesSource, layout.assetNotesDest, layout, withFavicons, stats, validationSummary);
    if (layout.configSource && fs.existsSync(layout.configSource)) {
      await validateSourceFiles(layout.configSource, layout.configDest, layout, withFavicons, stats, validationSummary);
    }

    console.log('\n[dry-run] Sync plan:');
    console.log(`  Markdown files to sync: ${expectedFiles.size}`);
    console.log(`  Markdown files checked: ${validationSummary.markdownFiles}`);
    console.log(`  Stale files to delete:  ${staleFiles.length}`);
    console.log(`  Media files to copy:    ${mediaFiles.length}`);
    console.log(`  Media collisions:       ${collisions.length}`);
    console.log(`  YAML risk findings:     ${validationSummary.yamlRiskCount}`);
    console.log(`  Asset schema risks:     ${validationSummary.assetSchemaRiskCount}`);
    if (staleFiles.length > 0) {
      console.log(`\n  Stale files (first 10):`);
      staleFiles.slice(0, 10).forEach(f => console.log(`    - ${f}`));
      if (staleFiles.length > 10) console.log(`    ... and ${staleFiles.length - 10} more`);
    }
    if (collisions.length > 0) {
      console.log(`\n  Media collisions (${collisions.length}):`);
      console.log(`  Strategy: last-wins (last file copied overwrites earlier)`);
      console.log(`  ${'─'.repeat(60)}`);
      collisions.forEach(c => {
        console.log(`  ${c.basename}`);
        console.log(`    target: ${c.targetPath}`);
        c.sources.forEach((src, i) => {
          const marker = i === c.sources.length - 1 ? ' ← wins' : ' ✖ overwritten';
          console.log(`    source[${i}]: ${src}${marker}`);
        });
      });
      // Write collision report
      const reportDir = path.join(process.cwd(), 'reports');
      if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
      const report = collisions.map(c => ({
        basename: c.basename,
        targetPath: c.targetPath,
        sources: c.sources.map((src, i) => ({
          path: src,
          relativePath: path.relative(layout.mediaSource, src),
          outcome: i === c.sources.length - 1 ? 'wins' : 'overwritten',
        })),
        strategy: 'last-wins',
        recommendation: 'Rename one source file to avoid collision, or use directory-prefixed output paths',
      }));
      fs.writeFileSync(path.join(reportDir, 'media-collisions.json'), JSON.stringify(report, null, 2));
      console.log(`\n  Collision report written to: reports/media-collisions.json`);
    }
    if (stats.warnings.length > 0) {
      console.warn(`\n  Warnings (${stats.warnings.length}):`);
      stats.warnings.forEach(w => console.warn(`    ⚠ ${w}`));
    }
    if (stats.errors.length > 0) {
      console.error(`\n  Errors (${stats.errors.length}):`);
      stats.errors.forEach(err => console.error(`    ✖ ${err}`));
    }
    return stats.errors.length;
  }

  // Copy media assets (only in real sync, not dry-run)
  syncAssets(layout.mediaSource, layout.assetsDest, stats);

  // Clean stale files
  cleanStaleFiles(layout.notesDest, expectedFiles, stats);

  // Sync markdown files
  await syncFiles(layout.notesSource, layout.notesDest, layout, withFavicons, stats);
  await syncFiles(layout.assetNotesSource, layout.assetNotesDest, layout, withFavicons, stats);

  // Sync config directory
  if (layout.configSource) {
    const fs = await import('fs');
    if (fs.existsSync(layout.configSource)) {
      await syncFiles(layout.configSource, layout.configDest, layout, withFavicons, stats);
    }
  }

  // Build static JSON indexes from synced markdown
  buildIndexes(layout.notesDest);

  // Merge upstream asset-index fields (monitor, links, homepage) that the
  // local line-by-line YAML scanner cannot parse from multi-line block scalars.
  // upstreamKnowledgeIndexDir points to thought-forest/generated/knowledge-index/
  // (configurable via notesConfig.upstream.generatedPath or NOTES_UPSTREAM_GENERATED env var).
  const indexDir = path.join(process.cwd(), 'src', 'data', 'indexes');
  const upstreamKnowledgeIndexDir = path.resolve(
    process.cwd(),
    notesConfig.upstream.generatedPath,
    'knowledge-index'
  );
  mergeAssetIndex(upstreamKnowledgeIndexDir, indexDir);

  // Replace local link-graph.json with the upstream version which uses
  // gray-matter-resolved IDs and has pre-computed backlinks.
  copyUpstreamLinkGraph(upstreamKnowledgeIndexDir, indexDir);

  return printSyncReport(stats);
}
