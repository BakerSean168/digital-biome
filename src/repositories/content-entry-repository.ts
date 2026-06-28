/**
 * Content entry repository — the only module that calls getCollection('notes').
 *
 * Narrowed responsibilities:
 *   - Fetch individual or batch entries from Astro collection (for rendering)
 *   - Provide filtering predicates (isAssetEntry, isPublicNoteEntry, etc.)
 *   - "Which notes to generate" is now driven by the index, not collection filtering
 */

import { getCollection } from 'astro:content';
import type { NoteCollectionEntry, AssetNoteEntry } from '../types/notes';
import { isAssetNoteData } from '../types/notes';
import { inferVisibility } from '../domain/note-routing';
import { getPublicKnowledgeNoteEntriesFromIndex, getPublicNotesCountFromIndex } from './knowledge-index-loader';
import { ASSET_NOTE_PREFIX, VISIBILITY_PUBLIC } from '../domain/constants';

function fallbackTitle(note: NoteCollectionEntry): string {
  return note.id.split('/').pop()?.replace(/-/g, ' ') ?? note.id;
}

function normalizeTitle(note: NoteCollectionEntry): NoteCollectionEntry {
  if (!note.data.title) {
    return { ...note, data: { ...note.data, title: fallbackTitle(note) } };
  }
  return note;
}

/** Check whether a note is an asset entry (by data fields or path prefix). */
export function isAssetEntry(note: NoteCollectionEntry): boolean {
  return isAssetNoteData(note.data) || note.id.startsWith(ASSET_NOTE_PREFIX);
}

/** Check whether a note is a public knowledge note (not an asset). */
export function isPublicNoteEntry(note: NoteCollectionEntry): boolean {
  if (isAssetEntry(note)) return false;
  return inferVisibility({
    draft: note.data.draft,
    private: note.data.private,
    visibility: note.data.visibility,
  }) === VISIBILITY_PUBLIC;
}

/** Check whether a note is a public asset entry. */
export function isPublicAssetEntry(note: NoteCollectionEntry): note is AssetNoteEntry {
  if (!isAssetNoteData(note.data)) return false;
  return inferVisibility({
    draft: note.data.draft,
    private: note.data.private,
    visibility: note.data.visibility,
    isAsset: true,
  }) === VISIBILITY_PUBLIC;
}

/**
 * Get all content entries with normalized titles.
 * This is the ONLY function that calls Astro's getCollection without a filter.
 * Prefer getContentEntriesByIds() when you know which IDs you need.
 */
export async function getAllContentEntries(): Promise<NoteCollectionEntry[]> {
  const allNotes = await getCollection('notes');
  return allNotes.map(note => normalizeTitle(note as NoteCollectionEntry));
}

/**
 * Get content entries for a specific set of note IDs.
 *
 * Uses Astro's collection filter predicate to avoid loading entries
 * that are not in the requested set. Falls back to full scan + filter
 * if the predicate API is unavailable.
 */
export async function getContentEntriesByIds(ids: string[]): Promise<NoteCollectionEntry[]> {
  const idSet = new Set(ids);
  const filtered = await getCollection('notes', (entry) => idSet.has(entry.id));
  return filtered.map(note => normalizeTitle(note as NoteCollectionEntry));
}

/**
 * Get public knowledge note entries — for static path generation in [...slug].astro.
 *
 * "Which notes are public" is determined by the index, not by scanning the
 * full collection. The collection is still used to get the actual entries
 * (needed for `render()`).
 */
export async function getPublicKnowledgeNoteEntries(): Promise<NoteCollectionEntry[]> {
  const publicIds = getPublicKnowledgeNoteEntriesFromIndex().map(e => e.id);
  const entries = await getContentEntriesByIds(publicIds);
  // Preserve index ordering
  const orderMap = new Map(publicIds.map((id, i) => [id, i]));
  return [...entries].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
}

/**
 * Get total count of public notes.
 * Reads from the index instead of scanning the full collection.
 */
export function getPublicNotesCount(): number {
  return getPublicNotesCountFromIndex();
}
