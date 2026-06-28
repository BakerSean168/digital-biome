/**
 * Note ID utilities — zero external dependencies.
 *
 * Canonical note id format: `obsidian/<relative-path-without-extension>`
 * Examples:
 *   obsidian/vue-computed
 *   obsidian/assets/services/digital-biome-site
 *
 * `toNoteId()` is the single entry point for generating note IDs.
 * All callers (content config, sync pipeline, domain logic) should use it.
 */

/**
 * Canonical note ID generator.
 *
 * Converts a vault-relative file path (with or without .md extension)
 * into the canonical `obsidian/<path-without-extension>` format.
 *
 * @example
 *   toNoteId('vue-computed.md')         // 'obsidian/vue-computed'
 *   toNoteId('assets/services/site.md') // 'obsidian/assets/services/site'
 *   toNoteId('z/foo')                   // 'obsidian/z/foo'
 */
export function toNoteId(relativePath: string): string {
  return `obsidian/${relativePath.replace(/\.md$/, '')}`;
}

/** Strip the `obsidian/` prefix to get the vault-relative path. */
export function noteIdToRelativePath(noteId: string): string {
  return noteId.replace(/^obsidian\//, '');
}

/** Build a note id from a vault-relative file path. Alias for `toNoteId()`. */
export function relativePathToNoteId(relPath: string): string {
  return toNoteId(relPath);
}

/** Extract the basename (last path segment) from a note id. */
export function noteIdToBasename(noteId: string): string {
  const parts = noteId.split('/');
  return parts[parts.length - 1];
}

/** Check whether a note id refers to an asset note. */
export function isAssetNoteId(noteId: string): boolean {
  return noteId.startsWith('obsidian/assets/');
}

/**
 * Convert a note id to a URL-safe route slug.
 * Preserves the `obsidian/` prefix (it is part of the route).
 * Only strips legacy locale prefixes (zh/, en/) that may appear
 * at the start of the note id itself.
 *
 * Examples:
 *   obsidian/vue-computed        → obsidian/vue-computed
 *   obsidian/assets/services/svc → obsidian/assets/services/svc
 */
export function toRouteSlug(noteId: string): string {
  // Note IDs from the glob loader always start with `obsidian/`.
  // Only strip locale prefixes if they appear before the obsidian/ segment.
  return noteId.replace(/^(zh|en)\//, '');
}
