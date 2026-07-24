/**
 * Friends repository — friend links queries.
 *
 * Reads entirely from notes-index.json. No Astro collection dependency.
 */

import { getAllNoteEntries } from './knowledge-index-loader';
import { VISIBILITY_PRIVATE } from '../domain/constants';

export interface FriendLink {
  title: string;
  url: string;
  avatar?: string;
  description?: string;
  slug: string;
  tags: string[];
}

export function getFriendLinks(): FriendLink[] {
  const entries = getAllNoteEntries();

  return entries
    .filter(entry => {
      if (entry.draft || entry.private || entry.visibility === VISIBILITY_PRIVATE) return false;      if (!entry.url) return false;

      const tags = (entry.tags || []).map(t => t.toLowerCase());
      const isFriendLink =
        tags.includes('type/friend-link') ||
        tags.includes('media/friend-link') ||
        tags.includes('friend-link') ||
        tags.includes('friend') ||
        tags.includes('友链');

      return isFriendLink;
    })
    .map(entry => {
      // Find avatar from frontmatter icon / avatar / icon properties or fallback to favicon
      const avatar = entry.icon || (entry as any).avatar || undefined;
      return {
        title: entry.title || entry.id.split('/').pop() || 'Untitled',
        url: entry.url!,
        avatar,
        description: entry.description,
        slug: entry.id,
        tags: entry.tags || [],
      };
    });
}
