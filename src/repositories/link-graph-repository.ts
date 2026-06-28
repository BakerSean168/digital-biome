/**
 * Link graph repository — backlinks and outgoing links.
 *
 * Reads from the pre-built `link-graph.json` index instead of
 * computing the graph in-memory from Astro collection entries.
 */

import type { NoteIndexEntry } from '../types/knowledge-index';
import {
  getBacklinksMapFromIndex,
  getOutgoingMapFromIndex,
  getNoteEntryByIdFromIndex,
} from './knowledge-index-loader';

/**
 * Get backlinks for a note — notes that link TO the given note id.
 *
 * Returns NoteIndexEntry[] of the source notes.
 */
export function getBacklinksForNote(noteId: string): NoteIndexEntry[] {
  const backlinksMap = getBacklinksMapFromIndex();
  const sourceIds = backlinksMap.get(noteId) ?? [];
  return sourceIds
    .map(id => getNoteEntryByIdFromIndex(id))
    .filter((e): e is NoteIndexEntry => e != null);
}

/**
 * Get outgoing links for a note — notes that the given note links TO.
 *
 * Returns NoteIndexEntry[] of the target notes.
 */
export function getOutgoingLinksForNote(noteId: string): NoteIndexEntry[] {
  const outgoingMap = getOutgoingMapFromIndex();
  const targetIds = outgoingMap.get(noteId) ?? [];
  return targetIds
    .map(id => getNoteEntryByIdFromIndex(id))
    .filter((e): e is NoteIndexEntry => e != null);
}
