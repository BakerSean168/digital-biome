/**
 * Source layout resolution — reads notes.config.ts and resolves real paths.
 */

import fs from 'fs';
import path from 'path';
import type { SourceLayout } from './types';

export function resolveCandidatePath(input: string | string[]): string {
  const candidates = Array.isArray(input) ? input : [input];
  const resolved = candidates.map(candidate => (
    path.isAbsolute(candidate) ? candidate : path.join(process.cwd(), candidate)
  ));

  const existing = resolved.find(candidate => fs.existsSync(candidate));
  return existing ?? resolved[0];
}

/**
 * Build the full source layout from notesConfig.
 */
export function buildSourceLayout(notesConfig: {
  vault: {
    notesPath: string | string[];
    assetNotesPath: string | string[];
    mediaPath: string | string[];
    configPath?: string | string[];
  };
  output: {
    notes: string;
    assets: string;
  };
}): SourceLayout {
  const notesSource = resolveCandidatePath(notesConfig.vault.notesPath);
  const assetNotesSource = resolveCandidatePath(notesConfig.vault.assetNotesPath);
  const mediaSource = resolveCandidatePath(notesConfig.vault.mediaPath);
  const vaultRoot = path.dirname(notesSource);

  const notesDest = path.join(process.cwd(), notesConfig.output.notes);
  const assetNotesDest = path.join(notesDest, 'assets');
  const assetsDest = path.join(process.cwd(), notesConfig.output.assets);
  const faviconsDest = path.join(process.cwd(), 'public', 'favicons');

  const configSource = notesConfig.vault.configPath
    ? resolveCandidatePath(notesConfig.vault.configPath)
    : null;
  const configDest = path.join(notesDest, 'config');

  return {
    vaultRoot,
    notesSource,
    assetNotesSource,
    configSource,
    mediaSource,
    notesDest,
    assetNotesDest,
    configDest,
    assetsDest,
    faviconsDest,
    assetsUrlPrefix: '/vault-assets',
  };
}
