/**
 * Rebuild derived public indexes from the final reconciled notes-index.
 *
 * The notes index is the publication snapshot after Thought Forest metadata
 * reconciliation and Digital Biome privacy/redaction policy. Tag and asset
 * indexes must derive from that exact snapshot rather than from an earlier
 * local frontmatter parse, otherwise one sync can expose two metadata truths.
 */

import fs from 'node:fs';
import path from 'node:path';

interface NoteIndexEntry extends Record<string, unknown> {
  id: string;
  tags: string[];
  visibility?: 'public' | 'private' | 'internal';
  isAsset: boolean;
  asset_id?: string;
  asset_type?: string;
}

interface NotesIndex {
  version: number;
  generatedAt: string;
  entries: NoteIndexEntry[];
}

export function buildTagIndex(notes: NotesIndex): {
  version: number;
  generatedAt: string;
  tags: Array<{ tag: string; count: number }>;
} {
  const counts = new Map<string, number>();
  for (const note of notes.entries) {
    if (note.visibility !== 'public') continue;
    for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return {
    version: notes.version,
    generatedAt: notes.generatedAt,
    tags: [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function buildAssetIndex(notes: NotesIndex): {
  version: number;
  generatedAt: string;
  entries: NoteIndexEntry[];
} {
  return {
    version: notes.version,
    generatedAt: notes.generatedAt,
    entries: notes.entries.filter(note => note.isAsset && Boolean(note.asset_id) && Boolean(note.asset_type)),
  };
}

export function rebuildDerivedIndexes(indexDir: string): void {
  const notesPath = path.join(indexDir, 'notes-index.json');
  if (!fs.existsSync(notesPath)) {
    throw new Error(`[rebuild-derived-indexes] Missing final notes index at ${notesPath}`);
  }

  const notes = JSON.parse(fs.readFileSync(notesPath, 'utf8')) as NotesIndex;
  const tagIndex = buildTagIndex(notes);
  const assetIndex = buildAssetIndex(notes);

  fs.writeFileSync(path.join(indexDir, 'tag-index.json'), JSON.stringify(tagIndex, null, 2), 'utf8');
  fs.writeFileSync(path.join(indexDir, 'asset-index.json'), JSON.stringify(assetIndex, null, 2), 'utf8');
  console.log(
    `  [rebuild-derived-indexes] Derived ${tagIndex.tags.length} tags and ${assetIndex.entries.length} assets from reconciled notes`,
  );
}
