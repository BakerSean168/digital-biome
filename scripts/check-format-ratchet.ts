import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export interface FormatDebtBaseline {
  version: 1;
  files: Record<string, string>;
}

const ROOT_DIRECTORIES = ['src', 'scripts', 'functions', 'edge', 'e2e'] as const;
const CODE_EXTENSIONS = new Set(['.ts', '.js', '.cjs', '.mjs', '.astro', '.css']);
const ROOT_FILES = [
  'astro.config.mjs',
  'notes.config.ts',
  'playwright.config.ts',
  'package.json',
  'tsconfig.json',
  'biome.json',
  'prettier.config.mjs',
] as const;
const GENERATED_FILES = new Set(['worker-configuration.d.ts']);
const BASELINE_PATH = 'scripts/format-baseline.json';

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
    if (!GENERATED_FILES.has(relative)) results.push(relative);
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

export function hashFile(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function classifyFormatTargets(
  root: string,
  targets: readonly string[],
  baseline: FormatDebtBaseline,
): {
  grandfathered: string[];
  changedLegacy: string[];
  mustCheck: string[];
  staleBaseline: string[];
} {
  const targetSet = new Set(targets);
  const grandfathered: string[] = [];
  const changedLegacy: string[] = [];
  const mustCheck: string[] = [];

  for (const relative of targets) {
    const expectedHash = baseline.files[relative];
    if (!expectedHash) {
      mustCheck.push(relative);
      continue;
    }
    const currentHash = hashFile(path.join(root, relative));
    if (currentHash === expectedHash) grandfathered.push(relative);
    else {
      changedLegacy.push(relative);
      mustCheck.push(relative);
    }
  }

  const staleBaseline = Object.keys(baseline.files)
    .filter((relative) => !targetSet.has(relative) || !fs.existsSync(path.join(root, relative)))
    .sort();

  return { grandfathered, changedLegacy, mustCheck, staleBaseline };
}

function readBaseline(root: string): FormatDebtBaseline {
  const baselinePath = path.join(root, BASELINE_PATH);
  const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as FormatDebtBaseline;
  if (parsed.version !== 1 || !parsed.files || Array.isArray(parsed.files)) {
    throw new Error('Invalid format debt baseline.');
  }
  return parsed;
}

export function runFormatRatchet(root = process.cwd()): void {
  const targets = discoverFormatTargets(root);
  const baseline = readBaseline(root);
  const result = classifyFormatTargets(root, targets, baseline);

  if (result.staleBaseline.length > 0) {
    throw new Error(`Remove stale format baseline entries: ${result.staleBaseline.join(', ')}`);
  }

  if (result.mustCheck.length > 0) {
    const prettier = spawnSync('pnpm', ['exec', 'prettier', '--check', ...result.mustCheck], {
      cwd: root,
      encoding: 'utf8',
    });
    if (prettier.stdout) process.stdout.write(prettier.stdout);
    if (prettier.stderr) process.stderr.write(prettier.stderr);
    if (prettier.status !== 0) {
      throw new Error('Prettier check failed for new or changed files.');
    }
  }

  if (result.changedLegacy.length > 0) {
    throw new Error(
      `Formatted legacy files must graduate from ${BASELINE_PATH}: ${result.changedLegacy.join(', ')}`,
    );
  }

  console.log(
    `Format ratchet passed: ${result.mustCheck.length} formatted target(s), ` +
      `${result.grandfathered.length} unchanged legacy target(s).`,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runFormatRatchet();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
