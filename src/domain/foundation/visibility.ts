/**
 * Unified visibility inference — zero external dependencies.
 *
 * Single source of truth for determining a note's effective visibility.
 * Used by content-entry-repository (build-time filtering), slug-resolver
 * (wikilink privacy filtering), and build-indexes.ts (index generation).
 *
 * Priority chain (first match wins):
 *   1. draft=true           → 'private'
 *   2. private=true         → 'private'
 *   3. visibility='private' → 'private'
 *   4. visibility='internal'→ 'internal'
 *   5. asset without explicit visibility='public' → 'private'
 *   6. otherwise            → 'public'
 */

import type { Visibility } from './constants';

interface VisibilityInput {
  draft?: boolean | null;
  private?: boolean | null;
  visibility?: string | null;
  /** Whether the note is an asset (has asset_id + asset_type). */
  isAsset?: boolean;
}

/**
 * Infer the effective visibility of a note from its frontmatter fields.
 *
 * Returns the resolved Visibility value — never undefined.
 */
export function inferVisibility(input: VisibilityInput): Visibility {
  if (input.draft === true) return 'private';
  if (input.private === true) return 'private';
  if (input.visibility === 'private') return 'private';
  if (input.visibility === 'internal') return 'internal';

  // Assets require explicit `visibility: 'public'` to be visible.
  // Knowledge notes default to public.
  if (input.isAsset) {
    return input.visibility === 'public' ? 'public' : 'private';
  }

  return 'public';
}
