/**
 * Bookmarks repository — bookmark and category queries.
 *
 * Reads entirely from notes-index.json. No Astro collection dependency.
 */

import type { Bookmark, Category } from '../types/notes';
import { getAllNoteEntries, getNoteEntryByIdFromIndex } from './knowledge-index-loader';
import { extractCategories } from '../view-models/bookmark-item';
import { VISIBILITY_PRIVATE, CONFIG_RESOURCE_TYPES_SLUG } from '../domain/constants';

const HOMEPAGE_FEATURED_BOOKMARK_SLUGS = [
  'chatgpt',
  'bilibili',
  'youtube',
  'pinterest',
  'github',
  'linux-do',
  'reddit',
] as const;

/** Get resource type tags from the config note in the index. */
function getResourceTypesFromIndex(): string[] {
  const configNote = getNoteEntryByIdFromIndex(CONFIG_RESOURCE_TYPES_SLUG);
  if (configNote?.tags) {
    return configNote.tags.map(t => t.toLowerCase());
  }
  return [];
}

/** Get all bookmarks (notes with url + website/resource tags). */
export function getBookmarks(): Bookmark[] {
  const entries = getAllNoteEntries();
  const resourceTypes = getResourceTypesFromIndex();

  return entries
    .filter(entry => {
      if (entry.draft || entry.private || entry.visibility === VISIBILITY_PRIVATE) return false;
      if (entry.isAsset) return false;

      const tags = entry.tags || [];
      const hasWebsite = tags.some(tag => tag.toLowerCase() === 'website');
      const hasResource = tags.some(tag => tag.toLowerCase() === 'resource');

      const isLegacy = entry.url && tags.some(tag => tag === 'type/resource');
      const isNew = entry.url && hasWebsite && hasResource && extractCategories(tags, resourceTypes).length > 0;

      return isLegacy || isNew;
    })
    .map(entry => ({
      title: entry.title,
      url: entry.url!,
      description: entry.description,
      categories: extractCategories(entry.tags || [], resourceTypes),
      icon: entry.icon,
      slug: entry.id,
    }));
}

/** Get categories with counts. */
export function getCategories(): Category[] {
  const entries = getAllNoteEntries();
  const resourceTypes = getResourceTypesFromIndex();
  const categoryMap = new Map<string, number>();

  entries
    .filter(e => !e.draft && !e.private && e.visibility !== VISIBILITY_PRIVATE && !e.isAsset)
    .forEach(entry => {
      const cats = extractCategories(entry.tags || [], resourceTypes);
      cats.forEach(cat => {
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
      });
    });

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

  bookmarks.forEach(bookmark => {
    bookmark.categories.forEach(category => {
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(bookmark);
    });
  });

  return categoryMap;
}

/** Get homepage featured bookmarks. */
export function getHomepageFeaturedBookmarks(): Bookmark[] {
  const bookmarks = getBookmarks();
  const bookmarkMap = new Map(
    bookmarks.map(bookmark => [bookmark.slug.split('/').pop()?.toLowerCase(), bookmark] as const)
  );

  return HOMEPAGE_FEATURED_BOOKMARK_SLUGS
    .map(slug => bookmarkMap.get(slug))
    .filter((bookmark): bookmark is Bookmark => Boolean(bookmark));
}
