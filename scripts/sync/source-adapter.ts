/**
 * Source adapter — reads vault files, processes content, writes to destination.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { processContent, detectYamlRisks } from './markdown-transform';
import { cacheFavicon } from './favicon-cache';
import { collectFiles } from './fs-utils';
import type { SourceLayout, SyncStats } from './types';

export interface ValidationSummary {
  markdownFiles: number;
  yamlRiskCount: number;
  assetSchemaRiskCount: number;
}

function extractFrontmatter(content: string): string | null {
  if (!content.startsWith('---')) return null;
  const secondDash = content.indexOf('\n---', 3);
  if (secondDash === -1) return null;
  return content.slice(0, secondDash + 4);
}

function hasFrontmatterField(frontmatter: string | null, field: string): boolean {
  if (!frontmatter) return false;
  const pattern = new RegExp(`^${field}:\\s*.+$`, 'm');
  return pattern.test(frontmatter);
}

/**
 * Check if the vault git submodule is out of sync.
 */
export function warnIfVaultSubmoduleOutOfSync(vaultRoot: string, stats: SyncStats): void {
  const relativeVaultRoot = path.relative(process.cwd(), vaultRoot);
  if (!relativeVaultRoot || relativeVaultRoot.startsWith('..')) return;

  try {
    const status = execSync(
      `git submodule status -- "${relativeVaultRoot}"`,
      { cwd: process.cwd(), encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();

    const prefix = status[0];
    if (prefix === '+') {
      stats.warnings.push(
        `Submodule ${relativeVaultRoot} is ahead of the commit recorded in the main repo. Commit the submodule pointer before deploying, or CI may build stale notes data.`
      );
    } else if (prefix === '-') {
      stats.warnings.push(
        `Submodule ${relativeVaultRoot} is not initialized. Run "git submodule update --init --recursive" before syncing notes.`
      );
    } else if (prefix === 'U') {
      stats.errors.push(
        `Submodule ${relativeVaultRoot} has merge conflicts. Resolve them before syncing notes.`
      );
    }
  } catch {
    // Ignore when the selected vault root is not a git submodule.
  }
}

/**
 * Collect expected .md files from all sources (for stale detection).
 */
export function collectExpectedFiles(layout: SourceLayout): Set<string> {
  const expectedFiles = new Set(
    Array.from(collectFiles(layout.notesSource, layout.notesSource))
      .filter(f => f.endsWith('.md'))
  );

  if (fs.existsSync(layout.assetNotesSource)) {
    const assetNoteFiles = collectFiles(layout.assetNotesSource, layout.assetNotesSource);
    for (const f of assetNoteFiles) {
      if (f.endsWith('.md')) {
        expectedFiles.add(path.join('assets', f));
      }
    }
  }

  if (layout.configSource && fs.existsSync(layout.configSource)) {
    const configFiles = collectFiles(layout.configSource, layout.configSource);
    for (const f of configFiles) {
      if (f.endsWith('.md')) {
        expectedFiles.add(path.join('config', f));
      }
    }
  }

  return expectedFiles;
}

export async function validateSourceFiles(
  srcDir: string,
  destDir: string,
  layout: SourceLayout,
  withFavicons: boolean,
  stats: SyncStats,
  summary: ValidationSummary
): Promise<void> {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source directory does not exist: ${srcDir}. Check notes.config.ts for correct paths.`);
  }

  const files = fs.readdirSync(srcDir);

  for (const file of files) {
    if (file.startsWith('.')) continue;

    const srcPath = path.join(srcDir, file);
    const nextDestPath = path.join(destDir, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      await validateSourceFiles(srcPath, nextDestPath, layout, withFavicons, stats, summary);
      continue;
    }

    if (!file.endsWith('.md')) {
      continue;
    }

    summary.markdownFiles += 1;

    try {
      const content = fs.readFileSync(srcPath, 'utf-8');
      const frontmatter = extractFrontmatter(content);

      if (content.startsWith('---') && !frontmatter) {
        stats.warnings.push(`${path.relative(layout.vaultRoot, srcPath)}: frontmatter block is not closed; sync will normalize it`);
      }

      if (frontmatter) {
        const yamlRisks = detectYamlRisks(frontmatter, path.relative(layout.vaultRoot, srcPath));
        summary.yamlRiskCount += yamlRisks.length;
        stats.warnings.push(...yamlRisks);
      }

      const isAssetNote = srcPath.startsWith(layout.assetNotesSource);
      if (isAssetNote) {
        const hasAssetId = hasFrontmatterField(frontmatter, 'asset_id');
        const hasAssetType = hasFrontmatterField(frontmatter, 'asset_type');
        if (!hasAssetId || !hasAssetType) {
          summary.assetSchemaRiskCount += 1;
          stats.warnings.push(
            `${path.relative(layout.vaultRoot, srcPath)}: asset note is missing ${!hasAssetId && !hasAssetType ? 'asset_id and asset_type' : !hasAssetId ? 'asset_id' : 'asset_type'}`
          );
        }
      }

      processContent(content, file, layout.assetsUrlPrefix);

      if (withFavicons) {
        const urlMatch = content.match(/^url:\s*['"]?([^'"\n]+)['"]?/m);
        if (urlMatch && urlMatch[1]) {
          // Dry-run validation should not download favicons; we only confirm the URL can be discovered.
        }
      }
    } catch (err) {
      stats.errors.push(`${path.relative(layout.vaultRoot, srcPath)}: ${err}`);
    }
  }
}

/**
 * Recursively sync .md files from srcDir to destDir,
 * processing content and caching favicons along the way.
 */
export async function syncFiles(
  srcDir: string,
  destDir: string,
  layout: SourceLayout,
  withFavicons: boolean,
  stats: SyncStats
): Promise<void> {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source directory does not exist: ${srcDir}. Check notes.config.ts for correct paths.`);
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const files = fs.readdirSync(srcDir);

  for (const file of files) {
    if (file.startsWith('.')) continue;

    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      await syncFiles(srcPath, destPath, layout, withFavicons, stats);
    } else if (file.endsWith('.md')) {
      try {
        let content = fs.readFileSync(srcPath, 'utf-8');

        // Detect YAML risks in frontmatter before processing
        const frontmatter = extractFrontmatter(content);
        if (frontmatter) {
          const risks = detectYamlRisks(frontmatter, file);
          stats.warnings.push(...risks);
        }

        // Extract URL for favicon caching (optional)
        if (withFavicons) {
          const urlMatch = content.match(/^url:\s*['"]?([^'"\n]+)['"]?/m);
          if (urlMatch && urlMatch[1]) {
            await cacheFavicon(urlMatch[1], layout.faviconsDest, stats);
          }
        }

        content = processContent(content, file, layout.assetsUrlPrefix);
        fs.writeFileSync(destPath, content, 'utf-8');
        stats.copied++;
      } catch (err) {
        stats.errors.push(`${file}: ${err}`);
      }
    } else {
      stats.skipped++;
    }
  }
}
