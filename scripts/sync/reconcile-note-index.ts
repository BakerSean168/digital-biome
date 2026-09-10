/**
 * Reconcile Digital Biome's route-oriented notes index with Thought Forest's
 * full-YAML metadata projection.
 *
 * Digital Biome still owns the publication set, route/filePath identity,
 * stricter asset visibility policy, normalized ISO dates, and site-specific
 * fields. Thought Forest owns metadata that its gray-matter based parser can
 * represent more faithfully than the local line scanner.
 */

import fs from 'node:fs';
import path from 'node:path';

interface UpstreamNote {
  sourcePath: string;
  title: string;
  description?: string;
  tags: string[];
  aliases: string[];
  noteType?: string;
  status?: string;
  visibility: 'public' | 'private' | 'internal';
}

interface LocalNote extends Record<string, unknown> {
  id: string;
  filePath: string;
  title: string;
  description?: string;
  tags: string[];
  aliases: string[];
  type: string;
  status?: string;
  visibility?: 'public' | 'private' | 'internal';
}

interface LocalNotesIndex {
  version: number;
  generatedAt: string;
  entries: LocalNote[];
}

export function toUpstreamSourcePath(localFilePath: string): string | null {
  const normalized = localFilePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('../')) return null;
  if (normalized.startsWith('blogs/')) return null;
  if (normalized.startsWith('assets/') || normalized.startsWith('config/')) return normalized;
  return `z/${normalized}`;
}

export function reconcileNote(
  local: LocalNote,
  upstream: UpstreamNote | undefined,
): LocalNote {
  if (!upstream) return local;

  return {
    ...local,
    title: upstream.title.trim(),
    description: upstream.description,
    tags: [...upstream.tags],
    aliases: [...upstream.aliases],
    type: upstream.noteType ?? local.type,
    status: upstream.status ?? local.status,
  };
}

export function reconcileNoteIndex(knowledgeIndexDir: string, indexDir: string): void {
  const upstreamPath = path.join(knowledgeIndexDir, 'notes-index.json');
  const localPath = path.join(indexDir, 'notes-index.json');
  if (!fs.existsSync(upstreamPath) || !fs.existsSync(localPath)) {
    console.log('  [reconcile-note-index] Upstream or local notes-index missing - skipping');
    return;
  }

  const upstream = JSON.parse(fs.readFileSync(upstreamPath, 'utf8')) as UpstreamNote[];
  const local = JSON.parse(fs.readFileSync(localPath, 'utf8')) as LocalNotesIndex;
  const bySourcePath = new Map(upstream.map(note => [note.sourcePath.replace(/\\/g, '/'), note]));

  let reconciled = 0;
  const entries = local.entries.map(note => {
    const sourcePath = toUpstreamSourcePath(note.filePath);
    if (!sourcePath) return note;
    const upstreamNote = bySourcePath.get(sourcePath);
    if (!upstreamNote) return note;
    reconciled += 1;
    return reconcileNote(note, upstreamNote);
  });

  fs.writeFileSync(localPath, JSON.stringify({ ...local, entries }, null, 2), 'utf8');
  console.log(`  [reconcile-note-index] Reconciled ${reconciled}/${local.entries.length} local notes`);
}
