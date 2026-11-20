/**
 * Friends repository — friend links queries.
 *
 * Reads entirely from notes-index.json. No Astro collection dependency.
 */

import { getAllNoteEntries } from './knowledge-index-loader';
import type { NoteIndexEntry } from '../types/knowledge-index';
import { VISIBILITY_PUBLIC } from '../domain/foundation/constants';

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

  return (
    entries
      // Thought Forest owns collection membership through the source path, not tag spelling.
      .filter(
        (entry) =>
          entry.filePath.startsWith('pages/friends/') &&
          !entry.draft &&
          !entry.private &&
          entry.visibility === VISIBILITY_PUBLIC,
      )
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
      })
  );
}
