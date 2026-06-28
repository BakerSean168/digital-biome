/**
 * Note routing — unified wikilink/slug/URL resolution.
 *
 * This module is the single source of truth for:
 *   - note id ↔ relative path conversion
 *   - wikilink syntax parsing
 *   - wikilink target → note id resolution
 *   - note/asset → public URL construction
 *
 * Pure logic modules (note-id, wikilink-parser, visibility, constants)
 * are re-exported from the foundation layer. Astro-dependent modules
 * (url-builder, slug-resolver) remain here.
 */

// ── Foundation re-exports (zero external dependencies) ──

export {
  toNoteId,
  noteIdToRelativePath,
  relativePathToNoteId,
  noteIdToBasename,
  isAssetNoteId,
  toRouteSlug,
} from '../foundation/note-id';

export {
  parseWikilinks,
  parseNoteWikilinks,
} from '../foundation/wikilink-parser';
export type { ParsedWikilink } from '../foundation/wikilink-parser';

export { inferVisibility } from '../foundation/visibility';

export {
  VISIBILITY_PUBLIC,
  VISIBILITY_PRIVATE,
  VISIBILITY_INTERNAL,
  NOTE_ID_PREFIX,
  ASSET_NOTE_PREFIX,
  CONFIG_RESOURCE_TYPES_SLUG,
  COLLATION_LOCALE,
  DEFAULT_HOMEPAGE_ORDER,
  GIT_TS_MARKER,
  OBSIDIAN_NOTES_DIR,
} from '../foundation/constants';

// ── Astro-dependent modules (stay in note-routing) ──

export { buildSlugMap, resolveWikilinkTarget } from './slug-resolver';
export type { ResolveResult } from './slug-resolver';
export { buildKnowledgeNoteHref, buildAssetHref, remarkWikilinkHrefTemplate, appendWikilinkAnchor } from './url-builder';
