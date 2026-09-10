/**
 * Friends repository — friend links queries.
 *
 * Reads entirely from notes-index.json. No Astro collection dependency.
 */

import { getAllNoteEntries } from './knowledge-index-loader';
import type { NoteIndexEntry } from '../types/knowledge-index';
import { VISIBILITY_PRIVATE } from '../domain/constants';

export interface FriendLink {
  title: string;
  url: string;
  avatar?: string;
  description?: string;
  slug: string;
  tags: string[];
}

function hasUrl(entry: NoteIndexEntry): entry is NoteIndexEntry & { url: string } {
  return typeof entry.url === 'string' && entry.url.length > 0;
}

export function getFriendLinks(): FriendLink[] {
  const entries = getAllNoteEntries();

  return entries
    .filter((entry) => {
      if (entry.draft || entry.private || entry.visibility === VISIBILITY_PRIVATE) return false;
      if (!entry.url) return false;

      const tags = (entry.tags || []).map((t) => t.toLowerCase());
      const isFriendLink =
        tags.includes('type/friend-link') ||
        tags.includes('media/friend-link') ||
        tags.includes('friend-link') ||
        tags.includes('friend') ||
        tags.includes('友链');

      return isFriendLink;
    })
    .filter(hasUrl)
    .map((entry) => {
      // The public index exposes icon as the friend-avatar surface.
      const avatar = entry.icon;
      return {
        title: entry.title || entry.id.split('/').pop() || 'Untitled',
        url: entry.url,
        avatar,
        description: entry.description,
        slug: entry.id,
        tags: entry.tags || [],
      };
    });
}
