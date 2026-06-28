/**
 * Foundation layer — zero external dependencies.
 *
 * These modules contain pure business logic with NO imports from
 * `types/`, `astro:content`, or any other I/O-dependent module.
 * Both Astro-context code and plain tsx scripts (like build-indexes)
 * can safely import from here.
 */

export {
  type Visibility,
  type AssetType,
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
} from './constants';

export { inferVisibility } from './visibility';
export {
  toNoteId,
  noteIdToRelativePath,
  relativePathToNoteId,
  noteIdToBasename,
  isAssetNoteId,
  toRouteSlug,
} from './note-id';
export {
  parseWikilinks,
  parseNoteWikilinks,
} from './wikilink-parser';
export type { ParsedWikilink } from './wikilink-parser';
