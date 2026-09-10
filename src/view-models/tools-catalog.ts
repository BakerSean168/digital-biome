import type { Bookmark } from '../types/notes';

export const INITIAL_TOOL_CARD_COUNT = 16;

export interface ToolCatalogGroup {
  name: string;
  slug: string;
  bookmarks: Bookmark[];
}

export function buildToolCatalogGroups(
  bookmarksByCategory: ReadonlyMap<string, Bookmark[]>,
): ToolCatalogGroup[] {
  return Array.from(bookmarksByCategory.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bookmarks]) => ({
      name,
      slug: name.toLowerCase(),
      bookmarks: [...bookmarks],
    }));
}

export function countToolCatalogCards(groups: readonly ToolCatalogGroup[]): number {
  return groups.reduce((total, group) => total + group.bookmarks.length, 0);
}

export function takeInitialToolGroups(
  groups: readonly ToolCatalogGroup[],
  limit = INITIAL_TOOL_CARD_COUNT,
): ToolCatalogGroup[] {
  let remaining = Math.max(0, limit);
  const initial: ToolCatalogGroup[] = [];

  for (const group of groups) {
    if (remaining <= 0) break;
    const bookmarks = group.bookmarks.slice(0, remaining);
    if (bookmarks.length === 0) continue;
    initial.push({ ...group, bookmarks });
    remaining -= bookmarks.length;
  }

  return initial;
}

export function filterToolCatalog(
  groups: readonly ToolCatalogGroup[],
  query: string,
  categorySlug: string,
): ToolCatalogGroup[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCategory = categorySlug.trim().toLowerCase() || 'all';

  return groups.flatMap(group => {
    if (normalizedCategory !== 'all' && group.slug !== normalizedCategory) return [];
    const bookmarks = group.bookmarks.filter(bookmark => {
      if (!normalizedQuery) return true;
      const haystack = `${bookmark.title}\n${bookmark.description ?? ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
    return bookmarks.length > 0 ? [{ ...group, bookmarks }] : [];
  });
}
