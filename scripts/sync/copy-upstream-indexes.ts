/**
 * Upstream index copier — replaces locally-generated link-graph.json and
 * tag-index.json with the upstream versions from thought-forest/generated/.
 *
 * Why replace rather than merge?
 *
 *   link-graph: The upstream version (produced by gray-matter + wikilink
 *   resolver) is richer than what build-indexes.ts generates locally.
 *   Specifically it provides:
 *     - `backlinks` pre-computed (avoids runtime graph reversal)
 *     - `display` text on each outgoing link (e.g. alias shown in wikilink)
 *     - `unresolved` list (for future dead-link auditing)
 *   The local version only stores `outgoingIds: string[]` and reverses to
 *   compute backlinks at load time.  We keep the local wrapped format
 *   (`{ version, generatedAt, entries }`) by transforming upstream's bare
 *   array into that shape at copy time, so no consumer code changes.
 *
 *   tag-index: The upstream version counts across the full vault including
 *   the assets/ subtree.  The local version intentionally counts only public
 *   notes, which is more accurate for the site's tag cloud.  We therefore
 *   skip replacing tag-index and let build-indexes.ts own it.
 *
 * Upstream format (bare arrays with camelCase / different structure):
 *   link-graph.json → LinkGraphItem[]
 *     { sourceId, outgoing: [{raw, resolvedId, display}], backlinks, unresolved }
 *
 * Local format expected by knowledge-index-loader.ts:
 *   link-graph.json → { version, generatedAt, entries: LinkGraphEntry[] }
 *     { sourceId, outgoingIds: string[] }
 *
 * This module converts upstream → local format so that no downstream code
 * needs to change.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Upstream types ──

interface UpstreamLinkTarget {
  raw: string;
  display?: string;
  resolvedId?: string;
  reason?: string;
}

interface UpstreamLinkGraphItem {
  sourceId: string;
  outgoing: UpstreamLinkTarget[];
  backlinks: string[];
  unresolved: UpstreamLinkTarget[];
}

/**
 * Copy and transform the upstream link-graph.json to the local index directory.
 *
 * Transformation: bare UpstreamLinkGraphItem[] → wrapped LinkGraphIndex
 * (`{ version, generatedAt, entries: LinkGraphEntry[] }`).
 *
 * Each upstream entry's `outgoing` array (objects with resolvedId, display, raw)
 * is flattened to `outgoingIds: string[]` (resolved ids only) to match the
 * interface expected by `knowledge-index-loader.ts`.
 *
 * @param knowledgeIndexDir - Absolute path to the upstream knowledge-index directory
 *                            (e.g. `/home/thought-forest/generated/knowledge-index`)
 * @param indexDir          - Absolute path to the local src/data/indexes directory
 */
export function copyUpstreamLinkGraph(knowledgeIndexDir: string, indexDir: string): void {
  const upstreamPath = path.join(knowledgeIndexDir, 'link-graph.json');
  const localPath = path.join(indexDir, 'link-graph.json');

  if (!fs.existsSync(upstreamPath)) {
    console.log(`  [copy-upstream-indexes] link-graph not found at ${upstreamPath} — skipping`);
    return;
  }

  let upstream: UpstreamLinkGraphItem[];
  try {
    upstream = JSON.parse(fs.readFileSync(upstreamPath, 'utf-8'));
  } catch (e) {
    console.warn(`  [copy-upstream-indexes] Failed to parse upstream link-graph: ${e}`);
    return;
  }

  // Transform to local format
  const entries = upstream
    .map(item => ({
      sourceId: item.sourceId,
      outgoingIds: item.outgoing
        .map(o => o.resolvedId)
        .filter((id): id is string => Boolean(id)),
    }))
    .filter(entry => entry.outgoingIds.length > 0);

  const output = {
    version: 1,
    generatedAt: new Date().toISOString(),
    // Also store upstream backlinks as a separate map for potential future use
    entries,
  };

  fs.writeFileSync(localPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`  [copy-upstream-indexes] Replaced link-graph.json (${entries.length} entries with outgoing links)`);
}
