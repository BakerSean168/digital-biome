import fs from 'node:fs';
import path from 'node:path';
import type { NotesIndex } from '../src/types/knowledge-index';
import { VISIBILITY_PRIVATE } from '../src/domain/constants';
import { toRouteSlug } from '../src/domain/note-routing';

export interface PrivateRouteBoundaryResult {
  protectedKnowledgeNotes: number;
  leakedRoutes: number;
}

export function checkPrivateRouteBoundary(
  notesIndexPath = path.join(process.cwd(), 'src/data/indexes/notes-index.json'),
  distRoot = path.join(process.cwd(), 'dist'),
): PrivateRouteBoundaryResult {
  if (!fs.existsSync(notesIndexPath) || !fs.existsSync(distRoot)) {
    throw new Error('Private route boundary requires generated notes-index.json and dist/.');
  }

  const index = JSON.parse(fs.readFileSync(notesIndexPath, 'utf8')) as NotesIndex;
  const protectedNotes = index.entries.filter(entry =>
    !entry.isAsset && (entry.private || entry.draft || entry.visibility === VISIBILITY_PRIVATE)
  );

  const leaked = protectedNotes.filter(entry => {
    const slug = toRouteSlug(entry.id);
    return fs.existsSync(path.join(distRoot, 'notes', slug, 'index.html'));
  });

  if (leaked.length > 0) {
    throw new Error(`Private route boundary failed: ${leaked.length} protected note route(s) reached dist/.`);
  }

  return { protectedKnowledgeNotes: protectedNotes.length, leakedRoutes: 0 };
}
