/**
 * Blogs repository — blog posts queries.
 *
 * Reads entirely from notes-index.json.
 */

import { getAllNoteEntries } from './knowledge-index-loader';
import type { NoteIndexEntry } from '../types/knowledge-index';
import { VISIBILITY_PRIVATE } from '../domain/constants';
import { archiveMonthTimestamp } from '../domain/blog/archive-month';

function blogSortKey(note: NoteIndexEntry): number {
  const archive = archiveMonthTimestamp(note.archiveMonth);
  if (archive !== null) return archive;
  const updated = Date.parse(note.updated || note.created || '');
  return Number.isFinite(updated) ? updated : 0;
}

export function sortBlogPosts(posts: NoteIndexEntry[]): NoteIndexEntry[] {
  return [...posts].sort((a, b) => blogSortKey(b) - blogSortKey(a) || a.id.localeCompare(b.id));
}

export function getBlogPosts(): NoteIndexEntry[] {
  const entries = getAllNoteEntries();

  return sortBlogPosts(
    entries.filter((entry) => {
      if (entry.draft || entry.private || entry.visibility === VISIBILITY_PRIVATE) return false;

      const isBlog =
        entry.type === 'blog' ||
        entry.id.startsWith('note/blogs/') ||
        entry.tags?.some((t) => t.toLowerCase() === 'type/blog' || t.toLowerCase() === 'blog');

      return isBlog;
    }),
  );
}
