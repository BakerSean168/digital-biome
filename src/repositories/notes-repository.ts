/**
 * Notes repository — knowledge note queries.
 *
 * All public-note queries are index-driven: the notes-index.json
 * determines which note IDs are public, then getContentEntriesByIds
 * fetches only those entries from Astro's content collection.
 */

import type { NoteCollectionEntry } from '../types/notes';
import { getContentEntriesByIds } from './content-entry-repository';
import {
  getPublicKnowledgeNoteEntriesFromIndex,
  getTagCountsFromIndex,
} from './knowledge-index-loader';

/** Get all public knowledge notes (excluding assets, drafts, privates). */
export async function getPublicKnowledgeNotes(): Promise<NoteCollectionEntry[]> {
  const publicIds = getPublicKnowledgeNoteEntriesFromIndex().map((e) => e.id);
  return getContentEntriesByIds(publicIds);
}

/** Get tag counts from the pre-built index. Returns Map<tag, count>. */
export function getAllNoteTags(): Map<string, number> {
  const tags = getTagCountsFromIndex();
  return new Map(tags.map((t) => [t.tag, t.count]));
}
