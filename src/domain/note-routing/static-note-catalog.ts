/**
 * Static note catalog — note metadata for wikilink resolution at remark compile time.
 *
 * Source: the generated `notes-index.json` (written by `scripts/sync/build-indexes.ts`
 * during `pnpm sync`). It indexes every Markdown file under `src/data/obsidian`, so the
 * remark plugin never walks or re-parses the vault itself.
 */

import type { NotesIndex } from '../../types/knowledge-index';
import { buildSlugMap, resolveWikilinkTarget } from './slug-resolver';

// Static import — Vite/Astro inlines this at build time.
// If the file doesn't exist, the build will error (run `pnpm sync` first).
import notesIndexData from '../../data/indexes/notes-index.json';

interface StaticCatalogEntry {
  id: string;
  data: {
    title?: string | null;
    aliases?: string[] | null;
    draft?: boolean | null;
    private?: boolean | null;
    visibility?: string | null;
    asset_id?: string | null;
    asset_type?: 'service' | 'tool' | 'host' | 'network' | 'subscription' | 'project' | null;
  };
}

interface StaticCatalogCache {
  entries: StaticCatalogEntry[];
  slugMap: ReturnType<typeof buildSlugMap>;
}

let catalogCache: StaticCatalogCache | null = null;

function buildFromIndex(): StaticCatalogCache {
  const indexData = notesIndexData as unknown as NotesIndex;
  const entries: StaticCatalogEntry[] = indexData.entries.map((e) => ({
    id: e.id,
    data: {
      title: e.title ?? null,
      aliases: e.aliases ?? null,
      draft: e.draft ?? null,
      private: e.private ?? null,
      visibility: e.visibility ?? null,
      asset_id: e.asset_id ?? null,
      asset_type: e.asset_type ?? null,
    },
  }));
  return { entries, slugMap: buildSlugMap(entries) };
}

/** Load the static note catalog for wikilink resolution (built once per process). */
export function loadStaticNoteCatalog(): StaticCatalogCache {
  catalogCache ??= buildFromIndex();
  return catalogCache;
}

export function resolveStaticWikilink(target: string) {
  const catalog = loadStaticNoteCatalog();
  return resolveWikilinkTarget(target, catalog.slugMap, catalog.entries);
}
