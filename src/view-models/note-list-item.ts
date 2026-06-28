/**
 * Note list item view-model — transforms note entries into NoteListItem for rendering.
 *
 * Used by: notes index page, search results, sidebar lists, recent activity widgets.
 */

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
