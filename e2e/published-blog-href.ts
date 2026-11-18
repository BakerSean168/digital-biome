import { readFileSync } from 'node:fs';

interface PublicIndexEntry {
  id: string;
  draft: boolean;
  private: boolean;
  visibility?: string;
  isAsset?: boolean;
}

const index = JSON.parse(readFileSync('src/data/indexes/notes-index.json', 'utf8')) as {
  entries: PublicIndexEntry[];
};

const publishedIds = new Set(
  index.entries
    .filter(
      (entry) =>
        entry.id.startsWith('obsidian/blogs/') &&
        !entry.draft &&
        !entry.private &&
        entry.visibility !== 'private' &&
        !entry.isAsset,
    )
    .map((entry) => entry.id),
);

/** Playwright reads generated index bytes instead of importing Vite-only JSON modules. */
export function publishedBlogHref(slug: string): string | undefined {
  const id = `obsidian/blogs/${slug}`;
  return publishedIds.has(id) ? `/notes/${id}` : undefined;
}
