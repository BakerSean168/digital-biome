import type { Bookmark } from '../types/notes';

export const INITIAL_USES_CARD_COUNT = 16;

export interface UsesCatalogGroup {
  name: string;
  slug: string;
  bookmarks: Bookmark[];
}

export function buildUsesCatalogGroups(
  bookmarksByCategory: ReadonlyMap<string, Bookmark[]>,
): UsesCatalogGroup[] {
  return Array.from(bookmarksByCategory.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bookmarks]) => ({
      name,
      slug: name.toLowerCase(),
      bookmarks: [...bookmarks],
    }));
}
