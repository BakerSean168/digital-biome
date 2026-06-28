/**
 * Bookmark item view-model — transforms note entries into BookmarkItem for rendering.
 *
 * Used by: bookmark grid, category pages, homepage featured bookmarks.
 */

import type { NoteCollectionEntry } from '../types/notes';

export interface BookmarkItem {
  title: string;
  url: string;
  description?: string;
  categories: string[];
  icon?: string;
  slug: string;
}

/**
 * Extract category labels from tags.
 * Looks for `website/*` tags and resource-type tags.
 */
export function extractCategories(tags: string[], resourceTypes: string[]): string[] {
  const categories = new Set<string>();
  const normalizedResourceTypes = resourceTypes.map(r => r.toLowerCase());

  for (const tag of tags) {
    const lower = tag.toLowerCase();

    if (lower.startsWith('website/')) {
      const parts = tag.replace(/^website\//i, '').split('/');
      categories.add(parts[parts.length - 1]);
    }

    if (normalizedResourceTypes.includes(lower)) {
      categories.add(lower);
    }
  }

  return Array.from(categories);
}

/**
 * Transform a note entry into a BookmarkItem view-model.
 * Returns null if the note is not a bookmark (no url or no matching tags).
 */
export function toBookmarkItem(
  note: NoteCollectionEntry,
  resourceTypes: string[] = []
): BookmarkItem | null {
  const tags = note.data.tags || [];
  const url = note.data.url;

  if (!url) return null;

  const hasWebsite = tags.some((t: string) => t.toLowerCase() === 'website');
  const hasResource = tags.some((t: string) => t.toLowerCase() === 'resource');
  const isLegacy = tags.some((t: string) => t === 'type/resource');
  const categories = extractCategories(tags, resourceTypes);
  const isNew = hasWebsite && hasResource && categories.length > 0;

  if (!isLegacy && !isNew) return null;

  return {
    title: note.data.title,
    url,
    description: note.data.description,
    categories,
    icon: note.data.icon,
    slug: note.id,
  };
}
