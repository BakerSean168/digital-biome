/**
 * Notes utility facade — re-exports from repositories and view-models.
 *
 * This file preserves backward compatibility for existing page imports.
 * New code should import directly from:
 *   - src/repositories/content-entry-repository.ts
 *   - src/repositories/notes-repository.ts
 *   - src/repositories/assets-repository.ts
 *   - src/repositories/bookmarks-repository.ts
 *   - src/repositories/link-graph-repository.ts
 *   - src/repositories/recent-activity-repository.ts
 *   - src/view-models/asset-card.ts
 */

// --- Content entry base layer ---
export {
  isAssetEntry,
  isPublicNoteEntry,
  isPublicAssetEntry,
  getAllContentEntries,
  getPublicKnowledgeNoteEntries,
  getPublicNotesCount,
} from '../repositories/content-entry-repository';

// --- Knowledge notes ---
export {
  getPublicNotes,
  getPublicKnowledgeNotes,
  parseHierarchicalTag,
  extractTagRoots,
  getAllNoteTags,
} from '../repositories/notes-repository';
export type { ParsedTag } from '../repositories/notes-repository';

// --- Assets ---
export {
  getPublicAssets,
  getAssetByAssetId,
  getAssetsByAssetIds,
  getAssetsByType,
  getAssetsByHomepageSection,
  getRelatedAssetsByParent,
  getResourceTypes,
  sortByOrderThenTitle,
} from '../repositories/assets-repository';

// --- Bookmarks ---
export {
  getBookmarks,
  getCategories,
  getBookmarksByCategory,
  getHomepageFeaturedBookmarks,
} from '../repositories/bookmarks-repository';

// --- Link graph ---
export {
  getOutgoingLinksForNote,
  getBacklinksForNote,
} from '../repositories/link-graph-repository';

// --- Recent activity ---
export {
  getGitLastModified,
  getRecentNotes,
  getRecentNotesWithDate,
  getNewCreatedNotes,
} from '../repositories/recent-activity-repository';
export type { NoteWithDate } from '../repositories/recent-activity-repository';

// --- View-models ---
export { toAssetCard, inferAssetRole } from '../view-models/asset-card';
export { toNoteListItem } from '../view-models/note-list-item';
export type { NoteListItem } from '../view-models/note-list-item';
export { toBookmarkItem } from '../view-models/bookmark-item';
export type { BookmarkItem } from '../view-models/bookmark-item';

// --- Domain routing (for convenience) ---
export { toNoteId, toRouteSlug, buildKnowledgeNoteHref, inferVisibility } from '../domain/note-routing';

// --- Asset href (delegates to domain module) ---
export { buildAssetHref as getAssetHref } from '../domain/note-routing';

// --- Re-export all notes (getAllNotes for backward compat) ---
export { getAllContentEntries as getAllNotes } from '../repositories/content-entry-repository';

// --- Composite queries (kept here for backward compat) ---
import type { AssetCard, HomepageSection } from '../types/notes';
import { getPublicAssets, sortByOrderThenTitle } from '../repositories/assets-repository';
import { toAssetCard } from '../view-models/asset-card';

/** Get homepage featured assets for a section. */
export function getHomepageAssets(section: HomepageSection): AssetCard[] {
  const assets = getPublicAssets();
  const featured = assets
    .filter(asset => asset.data.homepage?.featured && asset.data.homepage?.section === section)
    .map(toAssetCard);
  return sortByOrderThenTitle(featured);
}

/** Get service display groups (operations vs projects). */
export function getServiceDisplayGroups(): {
  operations: AssetCard[];
  projects: AssetCard[];
} {
  const assets = getPublicAssets();
  const services = assets
    .filter(asset => asset.data.asset_type === 'service')
    .map(toAssetCard);

  return {
    operations: sortByOrderThenTitle(
      services.filter(asset => !asset.assetRole || asset.assetRole === 'ops' || asset.assetRole === 'portal')
    ),
    projects: sortByOrderThenTitle(
      services.filter(asset => asset.assetRole === 'product' || asset.assetRole === 'showcase')
    ),
  };
}

/** Get infrastructure assets (host + network). */
export function getInfrastructureAssets(): AssetCard[] {
  const assets = getPublicAssets();
  return assets
    .filter(asset => asset.data.asset_type === 'host' || asset.data.asset_type === 'network')
    .map(toAssetCard)
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
}
