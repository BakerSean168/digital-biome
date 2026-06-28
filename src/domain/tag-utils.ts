/**
 * Tag domain utilities — pure functions for tag parsing and extraction.
 *
 * These operate on plain string arrays and have no I/O dependencies.
 * Kept in the domain layer rather than the repository layer to
 * separate business logic from data access.
 */

export interface ParsedTag {
  root: string;
  path: string[];
  display: string;
  full: string;
}

/**
 * Parse a hierarchical tag string into its components.
 *
 * @example
 *   parseHierarchicalTag('tech/frontend/vue')
 *   // { root: 'tech', path: ['tech', 'frontend', 'vue'], display: 'vue', full: 'tech/frontend/vue' }
 */
export function parseHierarchicalTag(tag: string): ParsedTag {
  const parts = tag.split('/');
  return {
    root: parts[0],
    path: parts,
    display: parts[parts.length - 1],
    full: tag,
  };
}

/**
 * Extract the root-level segments from an array of hierarchical tags.
 *
 * @example
 *   extractTagRoots(['tech/frontend', 'tech/backend', 'life/reading'])
 *   // ['tech', 'life']
 */
export function extractTagRoots(tags: string[]): string[] {
  const roots = new Set<string>();
  for (const tag of tags) {
    roots.add(tag.split('/')[0]);
  }
  return Array.from(roots);
}
