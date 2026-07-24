/**
 * Shared types for the sync pipeline.
 */

export interface SyncStats {
  copied: number;
  cleaned: number;
  skipped: number;
  assetsCopied: number;
  faviconsCached: number;
  warnings: string[];
  errors: string[];
}

export interface SourceLayout {
  vaultRoot: string;
  notesSource: string;
  assetNotesSource: string;
  configSource: string | null;
  blogsSource: string | null;
  mediaSource: string;
  notesDest: string;
  assetNotesDest: string;
  configDest: string;
  blogsDest: string;
  assetsDest: string;
  faviconsDest: string;
  assetsUrlPrefix: string;
}
