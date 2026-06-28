/**
 * Slug resolver — maps wikilink targets to note ids.
 *
 * Resolution strategy:
 *   1. Exact match on noteId, relative id, title, or aliases (case-insensitive)
 *      — all four are stored in a flat lookup map at the same priority tier.
 *      If multiple distinct notes match the same key, returns 'ambiguous'.
 *   2. endsWith fallback on noteId (lower priority, only used if step 1 finds nothing)
 *
 * Private notes (draft, private, or visibility='private') are filtered out of
 * public candidates; if all matches are private, returns 'private' status.
 *
 * Uses inferVisibility() from the same domain module — single source of truth.
 */

import { inferVisibility } from '../foundation/visibility';
import { buildAssetHref, buildKnowledgeNoteHref } from './url-builder';

export interface ResolveResult {
  status: 'resolved' | 'missing' | 'ambiguous' | 'private' | 'asset';
  noteId?: string;
  href?: string;
  candidates?: string[];
}

interface NoteEntry {
  id: string;
  data: {
    title?: string | null;
    aliases?: string[] | null;
    draft?: boolean | null;
    private?: boolean | null;
    visibility?: string | null;
    asset_id?: string | null;
    asset_type?: 'service' | 'tool' | 'host' | 'network' | null;
  };
}

interface SlugMapEntry {
  noteId: string;
  isPrivate: boolean;
  isAsset: boolean;
  assetId?: string;
  assetType?: NonNullable<NoteEntry['data']['asset_type']>;
}

/**
 * Build a resolution map from note entries.
 * Keys are normalized (lowercase, trimmed) identifiers;
 * values are arrays of note ids that match that key.
 */
export function buildSlugMap(
  entries: NoteEntry[]
): Map<string, SlugMapEntry[]> {
  const map = new Map<string, SlugMapEntry[]>();

  function add(key: string, entry: SlugMapEntry) {
    const normalized = key.toLowerCase().trim();
    if (!normalized) return;
    const existing = map.get(normalized);
    if (existing) {
      if (!existing.some(e => e.noteId === entry.noteId)) {
        existing.push(entry);
      }
    } else {
      map.set(normalized, [entry]);
    }
  }

  for (const entry of entries) {
    const noteId = entry.id;
    const isPrivate = inferVisibility({
      draft: entry.data.draft,
      private: entry.data.private,
      visibility: entry.data.visibility,
    }) === 'private';
    const slugEntry: SlugMapEntry = {
      noteId,
      isPrivate,
      isAsset: Boolean(entry.data.asset_id && entry.data.asset_type),
      assetId: entry.data.asset_id ?? undefined,
      assetType: entry.data.asset_type ?? undefined,
    };

    // title
    if (entry.data.title) {
      add(entry.data.title, slugEntry);
    }

    // noteId itself
    add(noteId, slugEntry);

    // relative id (without obsidian/ prefix)
    const relativeId = noteId.replace(/^obsidian\//, '');
    add(relativeId, slugEntry);

    // aliases
    if (entry.data.aliases) {
      for (const alias of entry.data.aliases) {
        add(alias, slugEntry);
      }
    }
  }

  return map;
}

/**
 * Resolve a wikilink target to a note id.
 *
 * @param rawTarget — the raw string inside [[...]]
 * @param slugMap — built by `buildSlugMap`
 * @param allEntries — full entry list for endsWith fallback
 */
export function resolveWikilinkTarget(
  rawTarget: string,
  slugMap: Map<string, SlugMapEntry[]>,
  allEntries?: NoteEntry[]
): ResolveResult {
  const target = rawTarget.toLowerCase().trim();
  if (!target) return { status: 'missing' };

  // 1-4: exact match on map
  const candidates = slugMap.get(target);
  if (candidates && candidates.length > 0) {
    const publicCandidates = candidates.filter(c => !c.isPrivate);
    if (publicCandidates.length === 1) {
      const candidate = publicCandidates[0];
      if (candidate.isAsset && candidate.assetId && candidate.assetType) {
        return {
          status: 'asset',
          noteId: candidate.noteId,
          href: buildAssetHref({
            asset_id: candidate.assetId,
            asset_type: candidate.assetType as NonNullable<NoteEntry['data']['asset_type']>,
          }),
        };
      }
      return {
        status: 'resolved',
        noteId: candidate.noteId,
        href: buildKnowledgeNoteHref(candidate.noteId),
      };
    }
    if (publicCandidates.length > 1) {
      return {
        status: 'ambiguous',
        candidates: publicCandidates.map(c => c.noteId),
      };
    }
    // All candidates are private
    if (candidates.length === 1) {
      return { status: 'private', noteId: candidates[0].noteId };
    }
    return {
      status: 'ambiguous',
      candidates: candidates.map(c => c.noteId),
    };
  }

  // 5: endsWith fallback
  if (allEntries) {
    const matches = allEntries.filter(entry => entry.id.toLowerCase().endsWith('/' + target));
    if (matches.length > 0) {
      const publicMatches = matches.filter(entry => inferVisibility({
        draft: entry.data.draft,
        private: entry.data.private,
        visibility: entry.data.visibility,
      }) !== 'private');

      if (publicMatches.length === 1) {
        const match = publicMatches[0];
        if (match.data.asset_id && match.data.asset_type) {
          return {
            status: 'asset',
            noteId: match.id,
            href: buildAssetHref({
              asset_id: match.data.asset_id,
              asset_type: match.data.asset_type as NonNullable<NoteEntry['data']['asset_type']>,
            }),
          };
        }
        return {
          status: 'resolved',
          noteId: match.id,
          href: buildKnowledgeNoteHref(match.id),
        };
      }

      if (publicMatches.length > 1) {
        return {
          status: 'ambiguous',
          candidates: publicMatches.map(entry => entry.id),
        };
      }

      if (matches.length === 1) {
        return { status: 'private', noteId: matches[0].id };
      }

      return {
        status: 'ambiguous',
        candidates: matches.map(entry => entry.id),
      };
    }
  }

  return { status: 'missing' };
}
