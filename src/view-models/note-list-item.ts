/** Note metadata shared by the static notes page and its lazy catalog. */

import type { NoteCollectionEntry } from '../types/notes';
import { buildKnowledgeNoteHref } from '../domain/note-routing';

export interface NoteListItem {
  title: string;
  description?: string;
  href: string;
  tags: string[];
  created?: Date;
  updated?: Date;
  icon?: string;
}

export interface NoteCatalogItem {
  id: string;
  title: string;
  description: string;
  href: string;
  tags: string[];
  date: string;
  timestamp: number | null;
}

/** Transform a note entry into a NoteListItem view-model. */
export function toNoteListItem(note: NoteCollectionEntry): NoteListItem {
  return {
    title: note.data.title,
    description: note.data.description,
    href: buildKnowledgeNoteHref(note.id),
    tags: note.data.tags || [],
    created: note.data.created,
    updated: note.data.updated,
    icon: note.data.icon,
  };
}

function toTimestamp(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const timestamp = new Date(date).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function formatNoteDate(
  date: Date | string | null | undefined,
  now = new Date(),
): string {
  if (!date) return '2天前';
  const parsed = new Date(date);
  const timestamp = parsed.getTime();
  if (Number.isNaN(timestamp)) return '2天前';

  const diffDays = Math.ceil(Math.abs(now.getTime() - timestamp) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 30) return `${diffDays}天前`;
  return parsed.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

/** Transform a public note entry into the browser catalog shape. */
export function toNoteCatalogItem(
  note: NoteCollectionEntry,
  now = new Date(),
): NoteCatalogItem {
  const rawDate = note.data.updated || note.data.created;
  return {
    id: note.id,
    title: note.data.title,
    description: note.data.description || '',
    href: buildKnowledgeNoteHref(note.id),
    tags: note.data.tags || [],
    date: formatNoteDate(rawDate, now),
    timestamp: toTimestamp(rawDate),
  };
}

export function sortNoteCatalog(notes: NoteCatalogItem[]): NoteCatalogItem[] {
  return [...notes].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/** Apply the notes page query and ANDed tag filters. */
export function filterNoteCatalog(
  notes: NoteCatalogItem[],
  query: string,
  activeTags: string[],
): NoteCatalogItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedTags = activeTags
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean);

  return notes.filter(note => {
    const matchesQuery = !normalizedQuery || [
      note.title,
      note.description,
      note.id,
      ...note.tags,
    ].some(value => value.toLowerCase().includes(normalizedQuery));

    const matchesTags = normalizedTags.length === 0 || normalizedTags.every(activeTag =>
      note.tags.some(noteTag => noteTag.toLowerCase().includes(activeTag)),
    );

    return matchesQuery && matchesTags;
  });
}
