/**
 * Assets repository — asset note queries.
 *
 * Reads from asset-index.json instead of Astro collection.
 * Returns objects shaped like AssetNoteEntry for backward compatibility
 * with view-models and facade composite queries.
 */

import type {
  AssetNoteEntry,
  AssetType,
  HomepageSection,
  HomepageConfig,
} from '../types/notes';
import type { AssetIndexEntry } from '../types/knowledge-index';
import {
  getAssetIndex,
  getNoteEntryByIdFromIndex,
} from './knowledge-index-loader';
import {
  VISIBILITY_PRIVATE,
  COLLATION_LOCALE,
  DEFAULT_HOMEPAGE_ORDER,
  CONFIG_RESOURCE_TYPES_SLUG,
} from '../domain/constants';

/**
 * Adapter: shape an AssetIndexEntry like an AssetNoteEntry
 * so that existing view-models (toAssetCard, etc.) work unchanged.
 *
 * The `body`, `digest`, `rendered`, and `collection` fields are dummy values
 * required only by Astro's `render()` entry point. No application code reads
 * these fields on asset entries — consumers only access `entry.data.*`.
 *
 * The final `as unknown as AssetNoteEntry` is intentional: the source type
 * (`AssetIndexEntry`) and target type (`AssetNoteEntry`) have different
 * structures (JSON index vs Astro collection entry). This adapter bridges
 * the gap without hiding runtime errors — all `data.*` fields are assigned
 * explicitly from the source.
 */
function toCompatEntry(entry: AssetIndexEntry): AssetNoteEntry {
  return {
    id: entry.id,
    collection: 'notes' as AssetNoteEntry['collection'],
    data: {
      title: entry.title,
      description: entry.description ?? '',
      tags: entry.tags,
      created: entry.created ? new Date(entry.created) : undefined,
      updated: entry.updated ? new Date(entry.updated) : undefined,
      draft: entry.draft,
      private: entry.private,
      visibility: entry.visibility,
      type: (entry.type ?? 'note') as AssetNoteEntry['data']['type'],
      url: entry.url,
      icon: entry.icon,
      category: entry.category,
      aliases: entry.aliases,
      asset_id: entry.asset_id,
      asset_type: entry.asset_type,
      asset_role: entry.asset_role,
      host_asset_id: entry.host_asset_id,
      parent_asset_id: entry.parent_asset_id,
      homepage: entry.homepage as AssetNoteEntry['data']['homepage'],
      monitor: entry.monitor as AssetNoteEntry['data']['monitor'],
      links: entry.links ?? [],
      status: entry.status,
    },
    body: '',
    filePath: entry.filePath,
    digest: '',
    rendered: undefined as unknown as AssetNoteEntry['rendered'],
  } as unknown as AssetNoteEntry;
}

/** Get all public asset entries. */
export function getPublicAssets(): AssetNoteEntry[] {
  const index = getAssetIndex();
  return index.entries
    .filter(e => !e.draft && !e.private && e.visibility !== VISIBILITY_PRIVATE)
    .map(toCompatEntry);
}

/** Find a single asset by its asset_id. */
export function getAssetByAssetId(assetId: string): AssetNoteEntry | undefined {
  const index = getAssetIndex();
  const entry = index.entries.find(e => e.asset_id === assetId);
  return entry ? toCompatEntry(entry) : undefined;
}

/** Get assets by a list of asset_ids. */
export function getAssetsByAssetIds(assetIds: string[]): AssetNoteEntry[] {
  const wanted = new Set(assetIds);
  const index = getAssetIndex();
  return index.entries
    .filter(e => wanted.has(e.asset_id))
    .map(toCompatEntry);
}

/** Get all assets of a specific type, sorted by title. */
export function getAssetsByType(assetType: AssetType): AssetNoteEntry[] {
  const index = getAssetIndex();
  return index.entries
    .filter(e => e.asset_type === assetType && !e.draft && !e.private && e.visibility !== VISIBILITY_PRIVATE)
    .map(toCompatEntry)
    .sort((a, b) => a.data.title.localeCompare(b.data.title, COLLATION_LOCALE));
}

/** Get assets for a homepage section. */
export function getAssetsByHomepageSection(section: HomepageSection): AssetNoteEntry[] {
  const index = getAssetIndex();
  return index.entries
    .filter(e => e.homepage?.featured && e.homepage?.section === section
      && !e.draft && !e.private && e.visibility !== VISIBILITY_PRIVATE)
    .map(toCompatEntry)
    .sort((a, b) => {
      const orderDiff = (a.data.homepage?.order ?? DEFAULT_HOMEPAGE_ORDER) - (b.data.homepage?.order ?? DEFAULT_HOMEPAGE_ORDER);
      if (orderDiff !== 0) return orderDiff;
      return a.data.title.localeCompare(b.data.title, COLLATION_LOCALE);
    });
}

/** Get related assets by parent or host asset id. */
export function getRelatedAssetsByParent(assetId: string): AssetNoteEntry[] {
  const index = getAssetIndex();
  return index.entries
    .filter(e => e.parent_asset_id === assetId || e.host_asset_id === assetId)
    .map(toCompatEntry)
    .sort((a, b) => a.data.title.localeCompare(b.data.title, COLLATION_LOCALE));
}

/** Get resource type tags from config note. */
export function getResourceTypes(): string[] {
  const configNote = getNoteEntryByIdFromIndex(CONFIG_RESOURCE_TYPES_SLUG);
  if (configNote?.tags) {
    return configNote.tags.map(t => t.toLowerCase());
  }
  return [];
}

/** Sort items by homepage order, then title. Returns a new array (does not mutate input). */
export function sortByOrderThenTitle<T extends { title: string; homepage?: HomepageConfig }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aOrder = a.homepage?.order ?? DEFAULT_HOMEPAGE_ORDER;
    const bOrder = b.homepage?.order ?? DEFAULT_HOMEPAGE_ORDER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.title.localeCompare(b.title, COLLATION_LOCALE);
  });
}
