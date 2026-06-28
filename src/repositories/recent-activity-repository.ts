/**
 * Recent activity repository — git-based modification times and sorting.
 *
 * Candidate set comes from the index; git mtime logic is preserved.
 */

import { execSync } from 'child_process';
import { statSync } from 'fs';
import type { NoteCollectionEntry } from '../types/notes';
import type { NoteIndexEntry } from '../types/knowledge-index';
import { getContentEntriesByIds } from './content-entry-repository';
import { getPublicKnowledgeNoteEntriesFromIndex } from './knowledge-index-loader';
import { GIT_TS_MARKER, OBSIDIAN_NOTES_DIR } from '../domain/constants';
import { noteIdToRelativePath } from '../domain/note-routing';

const NOTES_PATH = OBSIDIAN_NOTES_DIR;

/** Get public knowledge note IDs from the index (no collection scan). */
function getPublicNoteIds(): string[] {
  return getPublicKnowledgeNoteEntriesFromIndex().map(e => e.id);
}

export function getGitLastModified(filePath: string): Date | null {
  try {
    const result = execSync(
      `git log -1 --format="%ct" -- "${filePath}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim();

    return result ? new Date(parseInt(result, 10) * 1000) : null;
  } catch {
    return null;
  }
}

/** Module-level cache for git mtime map (computed once per build). */
let gitMtimeCache: Map<string, Date> | null = null;

function getGitLastModifiedMap(basePath: string): Map<string, Date> {
  if (gitMtimeCache) return gitMtimeCache;

  try {
    const output = execSync(
      `git log --format="${GIT_TS_MARKER}%ct" --name-only -- "${basePath}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString();

    const fileToDate = new Map<string, Date>();
    let currentTimestamp: Date | null = null;

    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith(GIT_TS_MARKER)) {
        const unixSeconds = Number.parseInt(line.slice(GIT_TS_MARKER.length), 10);
        currentTimestamp = Number.isNaN(unixSeconds) ? null : new Date(unixSeconds * 1000);
        continue;
      }

      if (!currentTimestamp) continue;

      const normalizedPath = line.replace(/\\/g, '/');
      if (!fileToDate.has(normalizedPath)) {
        fileToDate.set(normalizedPath, currentTimestamp);
      }
    }

    gitMtimeCache = fileToDate;
    return fileToDate;
  } catch {
    const empty = new Map<string, Date>();
    gitMtimeCache = empty;
    return empty;
  }
}

function getFileLastModified(filePath: string): Date | null {
  try {
    return statSync(filePath).mtime;
  } catch {
    return null;
  }
}

function getNoteLastModified(
  note: NoteCollectionEntry,
  modifiedMap: Map<string, Date>
): Date | null {
  const relPath = noteIdToRelativePath(note.id);
  const filePath = `${NOTES_PATH}/${relPath}.md`;
  return modifiedMap.get(filePath) ?? getFileLastModified(filePath) ?? getGitLastModified(filePath);
}

export interface NoteWithDate {
  note: NoteCollectionEntry;
  date: Date;
}

/** Get recently updated notes. */
export async function getRecentNotes(limit: number = 5): Promise<NoteCollectionEntry[]> {
  const publicIds = getPublicNoteIds();
  const notes = await getContentEntriesByIds(publicIds);
  const modifiedMap = getGitLastModifiedMap(NOTES_PATH);

  return notes
    .map(note => ({ note, lastModified: getNoteLastModified(note, modifiedMap) }))
    .filter(({ lastModified }) => lastModified !== null)
    .sort((a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0))
    .slice(0, limit)
    .map(({ note }) => note);
}

/** Get recently updated notes with their modification dates. */
export async function getRecentNotesWithDate(limit: number = 5): Promise<NoteWithDate[]> {
  const publicIds = getPublicNoteIds();
  const notes = await getContentEntriesByIds(publicIds);
  const modifiedMap = getGitLastModifiedMap(NOTES_PATH);

  return notes
    .map(note => ({ note, lastModified: getNoteLastModified(note, modifiedMap) }))
    .filter((item): item is { note: NoteCollectionEntry; lastModified: Date } => item.lastModified !== null)
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
    .slice(0, limit)
    .map(({ note, lastModified }) => ({ note, date: lastModified }));
}

/** Get most recently created notes (by frontmatter `created` field). Pure index operation. */
export function getNewCreatedNotes(limit: number = 5): NoteIndexEntry[] {
  return getPublicKnowledgeNoteEntriesFromIndex()
    .filter(e => e.created != null)
    .sort((a, b) => new Date(b.created!).getTime() - new Date(a.created!).getTime())
    .slice(0, limit);
}
