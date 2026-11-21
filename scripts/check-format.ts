import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT_DIRECTORIES = ['src', 'scripts', 'functions', 'edge', 'e2e'] as const;
const CODE_EXTENSIONS = new Set(['.ts', '.js', '.cjs', '.mjs', '.astro', '.css']);
const ROOT_FILES = [
  'astro.config.mjs',
  'notes.config.ts',
  'playwright.config.ts',
  'package.json',
  'tsconfig.json',
  'biome.json',
  '.oxfmtrc.json',
  '.oxlintrc.json',
] as const;
const GENERATED_FILES = new Set(['worker-configuration.d.ts']);

function walk(directory: string, root: string, results: string[]): void {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, root, results);
      continue;
    }
    if (!entry.isFile() || !CODE_EXTENSIONS.has(path.extname(entry.name))) continue;
    const relative = path.relative(root, absolute).replaceAll(path.sep, '/');
    if (!GENERATED_FILES.has(entry.name)) results.push(relative);
  }
}

export function discoverFormatTargets(root = process.cwd()): string[] {
  const results: string[] = [];
  for (const directory of ROOT_DIRECTORIES) {
    walk(path.join(root, directory), root, results);
  }
  for (const file of ROOT_FILES) {
    if (fs.existsSync(path.join(root, file))) results.push(file);
  }
  const workflowRoot = path.join(root, '.github', 'workflows');
  if (fs.existsSync(workflowRoot)) {
    for (const entry of fs.readdirSync(workflowRoot, { withFileTypes: true })) {
      if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
        results.push(`.github/workflows/${entry.name}`);
      }
    }
  }
  return [...new Set(results)].sort();
}

/** The formatting policy is universal: no grandfathered source hashes or exceptions. */
export function runFormatCheck(root = process.cwd()): void {
  const targets = discoverFormatTargets(root);
  if (!targets.length) throw new Error('No formatting targets discovered.');
  const formatter = spawnSync('pnpm', ['exec', 'oxfmt', '--check', ...targets], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (formatter.stdout) process.stdout.write(formatter.stdout);
  if (formatter.stderr) process.stderr.write(formatter.stderr);
  if (formatter.status !== 0) throw new Error('Oxfmt check failed.');
  console.log(`Format check passed: ${targets.length} files, zero waivers.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runFormatCheck();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
