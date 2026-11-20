import { selectResourceEntries, selectHomepageResources } from '../domain/resource-collections';
/**
 * Bookmarks repository — bookmark and category queries.
 *
 * Reads entirely from notes-index.json. No Astro collection dependency.
 */

import type { Bookmark, Category } from '../types/notes';
import type { NoteIndexEntry } from '../types/knowledge-index';
import { getAllNoteEntries, getNoteEntryByIdFromIndex } from './knowledge-index-loader';
import { extractCategories } from '../view-models/bookmark-categories';
import { CONFIG_RESOURCE_TYPES_SLUG } from '../domain/foundation/constants';
import { parseUsagePriority } from '../domain/resource-order';

/** Get resource type tags from the config note in the index. */
function getResourceTypesFromIndex(): string[] {
  const configNote = getNoteEntryByIdFromIndex(CONFIG_RESOURCE_TYPES_SLUG);
  if (configNote?.tags) {
    return configNote.tags.map((t) => t.toLowerCase());
  }
  return [];
}

function hasUrl(entry: NoteIndexEntry): entry is NoteIndexEntry & { url: string } {
  return typeof entry.url === 'string' && entry.url.length > 0;
}

/** Get explicitly bookmarked public resources with a destination URL. */
export function getBookmarks(): Bookmark[] {
  const entries = getAllNoteEntries();
  const resourceTypes = getResourceTypesFromIndex();

  return selectResourceEntries(entries, 'bookmarks')
    .filter(hasUrl)
    .map((entry) => ({
      title: entry.title,
      url: entry.url,
      description: entry.description,
      categories: extractCategories(entry.tags || [], resourceTypes),
      icon: entry.icon,
      slug: entry.id,
      usagePriority: parseUsagePriority(entry.usagePriority),
    }));
}

/** Get categories with counts. */
export function getCategories(): Category[] {
  const categoryMap = new Map<string, number>();
  for (const bookmark of getBookmarks()) {
    for (const category of bookmark.categories)
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1);
  }

  return Array.from(categoryMap.entries())
    .map(([name, count]) => ({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Get bookmarks grouped by category. */
export function getBookmarksByCategory(): Map<string, Bookmark[]> {
  const bookmarks = getBookmarks();
  const categoryMap = new Map<string, Bookmark[]>();

  bookmarks.forEach((bookmark) => {
    bookmark.categories.forEach((category) => {
      const existing = categoryMap.get(category);
      if (existing) existing.push(bookmark);
      else categoryMap.set(category, [bookmark]);
    });
  });

  return categoryMap;
}

/** Get homepage featured bookmarks. */
export function getHomepageFeaturedBookmarks(): Bookmark[] {
  const bookmarks = getBookmarks();
  const byId = new Map(bookmarks.map((bookmark) => [bookmark.slug, bookmark]));
  return selectHomepageResources(getAllNoteEntries()).flatMap((entry) => {
    const bookmark = byId.get(entry.id);
    return bookmark ? [bookmark] : [];
  });
}
