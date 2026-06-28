/**
 * Knowledge index type definitions.
 *
 * These interfaces define the shape of the static index JSON files
 * generated during `pnpm sync` and consumed by the repository layer
 * at build time.
 *
 * Index files live in `src/data/indexes/`:
 *   - notes-index.json   — all note metadata (knowledge + asset)
 *   - link-graph.json    — outgoing link graph per note
 *   - tag-index.json     — tag occurrence counts
 *   - asset-index.json   — asset subset of notes-index
 */

import type {
  Visibility,
  AssetType,
  AssetRole,
  AssetLink,
  AssetMonitor,
  HomepageConfig,
} from './notes';

// ─── notes-index.json ────────────────────────────────────────

export interface NoteIndexEntry {
  /** Canonical note id, e.g. `obsidian/vue-computed` */
  id: string;
  title: string;
  description?: string;
  tags: string[];
  /** ISO 8601 date string */
  created?: string;
  /** ISO 8601 date string */
  updated?: string;
  draft: boolean;
  private: boolean;
  visibility?: Visibility;
  type: string;
  url?: string;
  icon?: string;
  category?: string;
  aliases: string[];
  isAsset: boolean;
  asset_id?: string;
  asset_type?: AssetType;
  asset_role?: AssetRole;
  host_asset_id?: string;
  parent_asset_id?: string;
  homepage?: HomepageConfig;
  monitor?: AssetMonitor;
  links?: AssetLink[];
  status?: string;
  /** Vault-relative file path (for git mtime queries) */
  filePath: string;
}

export interface NotesIndex {
  version: number;
  generatedAt: string;
  entries: NoteIndexEntry[];
}

// ─── link-graph.json ─────────────────────────────────────────

export interface LinkGraphEntry {
  /** Note id of the source */
  sourceId: string;
  /** Note ids this note links to (wikilinks + markdown links, deduped) */
  outgoingIds: string[];
}

export interface LinkGraphIndex {
  version: number;
  generatedAt: string;
  entries: LinkGraphEntry[];
}

// ─── tag-index.json ──────────────────────────────────────────

export interface TagIndexEntry {
  tag: string;
  count: number;
}

export interface TagIndex {
  version: number;
  generatedAt: string;
  tags: TagIndexEntry[];
}

// ─── asset-index.json ────────────────────────────────────────

export interface AssetIndexEntry extends NoteIndexEntry {
  isAsset: true;
  asset_id: string;
  asset_type: AssetType;
}

export interface AssetIndex {
  version: number;
  generatedAt: string;
  entries: AssetIndexEntry[];
}
