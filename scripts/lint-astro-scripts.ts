import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from '@astrojs/compiler-rs';

interface AstroAstNode {
  type?: string;
  openingElement?: { name?: { name?: string }; end?: number };
  closingElement?: { start?: number };
  [key: string]: unknown;
}

interface OxlintDiagnostic {
  filename: string;
  code?: string;
  message?: string;
  labels?: Array<{ span?: { line?: number; column?: number } }>;
}

interface OxlintResult {
  diagnostics?: OxlintDiagnostic[];
  number_of_files?: number;
}

function visit(node: unknown, inspect: (node: AstroAstNode) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) visit(item, inspect);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const value = node as AstroAstNode;
  if (value.type === 'JSXElement') inspect(value);
  for (const [key, item] of Object.entries(value)) {
    if (key !== 'parent') visit(item, inspect);
  }
}

export function discoverAstroFiles(root: string): string[] {
  const result: string[] = [];
  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.astro')) result.push(full);
    }
  }
  for (const directory of ['src', 'scripts', 'edge', 'functions', 'e2e']) {
    walk(path.join(root, directory));
  }
  return result.sort();
}

export function lintAstroScripts(files: readonly string[], root = process.cwd()): number {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'digital-biome-oxlint-astro-'));
  const sourceByVirtual = new Map<string, string>();
  let count = 0;
  try {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const parsed = parse(source);
      if (parsed.diagnostics.length) {
        throw new Error(`Astro parser rejected ${path.relative(root, file)}`);
      }
      visit(parsed.ast, (node) => {
        if (node.openingElement?.name?.name !== 'script') return;
        const start = node.openingElement.end;
        const end = node.closingElement?.start;
        if (typeof start !== 'number' || typeof end !== 'number' || end < start) {
          throw new Error(`Invalid Astro script range in ${path.relative(root, file)}`);
        }
        const code = source.slice(start, end);
        if (!code.trim()) return;
        const prefixLines = (source.slice(0, start).match(/\n/g) ?? []).length;
        const virtual = path.join(scratch, `script-${count}.ts`);
        fs.writeFileSync(virtual, '\n'.repeat(prefixLines) + code);
        sourceByVirtual.set(virtual, path.relative(root, file));
        count += 1;
      });
    }
    if (count === 0) throw new Error('No Astro script blocks discovered; lint coverage is absent.');
    const run = spawnSync(
      'pnpm',
      ['exec', 'oxlint', '--deny-warnings', '--format=json', ...sourceByVirtual.keys()],
      { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
    );
    if (run.error) throw run.error;
    let parsed: OxlintResult;
    try {
      parsed = JSON.parse(run.stdout) as OxlintResult;
    } catch {
      throw new Error(`Oxlint returned invalid diagnostic JSON: ${run.stderr || run.stdout}`);
    }
    if (parsed.number_of_files !== count) {
      throw new Error(
        `Astro lint coverage mismatch: expected ${count}, scanned ${parsed.number_of_files}`,
      );
    }
    const diagnostics = parsed.diagnostics ?? [];
    if (diagnostics.length) {
      const summary = diagnostics.map((item) => {
        const file = sourceByVirtual.get(path.resolve(item.filename)) ?? item.filename;
        const location = item.labels?.[0]?.span;
        return `${file}:${location?.line ?? '?'}:${location?.column ?? '?'} ${item.code}: ${item.message}`;
      });
      throw new Error(`Astro script Oxlint diagnostics:\n${summary.join('\n')}`);
    }
    if (run.status !== 0) {
      throw new Error(`Oxlint failed with exit ${run.status}: ${run.stderr || 'no details'}`);
    }
    return count;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const files = discoverAstroFiles(process.cwd());
    const scripts = lintAstroScripts(files);
    console.log(`Oxlint verified ${scripts} Astro <script> block(s) across ${files.length} files.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
