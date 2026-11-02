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
