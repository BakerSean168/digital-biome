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
  mediaSource: string;
  notesDest: string;
  assetNotesDest: string;
  configDest: string;
  assetsDest: string;
  faviconsDest: string;
  assetsUrlPrefix: string;
}
