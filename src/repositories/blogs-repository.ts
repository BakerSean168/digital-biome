/**
 * Blogs repository — blog posts queries.
 *
 * Reads entirely from notes-index.json.
 */

import { getAllNoteEntries, NoteIndexEntry } from './knowledge-index-loader';
import { VISIBILITY_PRIVATE } from '../domain/constants';

export function getBlogPosts(): NoteIndexEntry[] {
  const entries = getAllNoteEntries();

  return entries
    .filter(entry => {
      if (entry.draft || entry.private || entry.visibility === VISIBILITY_PRIVATE) return false;
      
      const isBlog =
        entry.type === 'blog' ||
        entry.id.startsWith('note/blogs/') ||
        (entry.tags && entry.tags.some(t => t.toLowerCase() === 'type/blog' || t.toLowerCase() === 'blog'));

      return isBlog;
    })
    .sort((a, b) => {
      const dateA = new Date(a.updated || a.created || 0).getTime();
      const dateB = new Date(b.updated || b.created || 0).getTime();
      return dateB - dateA;
    });
}
