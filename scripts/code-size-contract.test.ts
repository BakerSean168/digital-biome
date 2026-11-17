import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const MAX_CODE_LINES = 500;
const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.astro',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
]);
const SOURCE_DIRECTORIES = ['src', 'scripts', 'functions', 'edge', 'e2e', 'showcase', 'public'];
const ROOT_FILES = ['astro.config.mjs', 'notes.config.ts', 'playwright.config.ts'];
const GENERATED_PREFIXES = ['src/data/', 'public/pagefind/'];

function maintainedCodeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(ROOT, absolute).split(path.sep).join('/');
    if (GENERATED_PREFIXES.some((prefix) => relative.startsWith(prefix))) return [];
    if (entry.isDirectory()) return maintainedCodeFiles(absolute);
    return entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

function sourceLineCount(file: string): number {
  return readFileSync(file, 'utf8').trimEnd().split(/\r?\n/).length;
}

test('maintained source code and tests stay within 500 lines per file', () => {
  const files = [
    ...SOURCE_DIRECTORIES.flatMap((dir) =>
      existsSync(path.join(ROOT, dir)) ? maintainedCodeFiles(path.join(ROOT, dir)) : [],
    ),
    ...ROOT_FILES.filter((name) => existsSync(path.join(ROOT, name))).map((name) =>
      path.join(ROOT, name),
    ),
  ];
  assert.ok(files.length > 100, 'Code-size audit found too few files; check its scan roots');
  const violations = files
    .map((file) => ({ file: path.relative(ROOT, file), lines: sourceLineCount(file) }))
    .filter(({ lines }) => lines > MAX_CODE_LINES)
    .sort((a, b) => b.lines - a.lines);
  assert.deepEqual(
    violations,
    [],
    'Refactor oversized files into focused modules or components rather than raising the limit',
  );
});
