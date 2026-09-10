import fs from 'node:fs';
import path from 'node:path';

export const PAGEFIND_GENERATED_UI_FILES = [
  'pagefind-ui.js',
  'pagefind-ui.css',
  'pagefind-modular-ui.js',
  'pagefind-modular-ui.css',
  'pagefind-highlight.js',
] as const;

const REQUIRED_RUNTIME_FILES = ['pagefind.js', 'pagefind-entry.json', 'wasm.unknown.pagefind'] as const;

export interface PagefindPruneResult {
  removedFiles: string[];
  removedBytes: number;
}

export function prunePagefindGeneratedUi(pagefindDirectory: string): PagefindPruneResult {
  const removedFiles: string[] = [];
  let removedBytes = 0;

  for (const name of PAGEFIND_GENERATED_UI_FILES) {
    const filePath = path.join(pagefindDirectory, name);
    if (!fs.existsSync(filePath)) continue;
    removedBytes += fs.statSync(filePath).size;
    fs.rmSync(filePath);
    removedFiles.push(name);
  }

  return { removedFiles, removedBytes };
}

export function assertPagefindRuntimeSurface(pagefindDirectory: string): void {
  for (const name of REQUIRED_RUNTIME_FILES) {
    if (!fs.existsSync(path.join(pagefindDirectory, name))) {
      throw new Error(`Required Pagefind runtime file is missing: ${name}`);
    }
  }
  for (const name of PAGEFIND_GENERATED_UI_FILES) {
    if (fs.existsSync(path.join(pagefindDirectory, name))) {
      throw new Error(`Unused Pagefind generated UI artifact remains: ${name}`);
    }
  }
}
