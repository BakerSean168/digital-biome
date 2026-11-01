import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'src');
const MODULE_SUFFIXES = ['.astro', '.ts', '.tsx', '.js', '.mjs'] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    if (!entry.isFile() || !MODULE_SUFFIXES.some((ext) => file.endsWith(ext))) return [];
    if (/\.test\.[cm]?[jt]sx?$/.test(file)) return [];
    return [file];
  });
}

function readModules(file: string): string[] {
  const code = readFileSync(file, 'utf8');
  if (!file.endsWith('.astro')) return [code];
  const frontmatter = code.match(/^---\s*\n([\s\S]*?)\n---/);
  const clientScripts = [...code.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  return [...(frontmatter ? [frontmatter[1]] : []), ...clientScripts.map((match) => match[1])];
}

function staticImports(file: string): string[] {
  return readModules(file).flatMap((source) => {
    const parsed = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    return parsed.statements.flatMap((statement) => {
      if (
        (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        return [statement.moduleSpecifier.text];
      }
      return [];
    });
  });
}

function resolveLocalImport(file: string, specifier: string, known: Set<string>): string | null {
  const base = specifier.startsWith('.')
    ? path.resolve(path.dirname(file), specifier)
    : specifier.startsWith('@components/')
      ? path.join(SOURCE, 'components', specifier.slice('@components/'.length))
      : null;
  if (!base) return null;
  for (const candidate of [
    base,
    ...MODULE_SUFFIXES.map((suffix) => base + suffix),
    ...MODULE_SUFFIXES.map((suffix) => path.join(base, 'index' + suffix)),
  ]) {
    if (known.has(candidate)) return candidate;
  }
  return null;
}

function buildStaticGraph(): Map<string, string[]> {
  const files = sourceFiles(SOURCE);
  const known = new Set(files);
  return new Map(
    files.map((file) => [
      file,
      staticImports(file)
        .map((specifier) => resolveLocalImport(file, specifier, known))
        .filter((value): value is string => value !== null),
    ]),
  );
}

const graph = buildStaticGraph();
const relative = (file: string) => path.relative(ROOT, file).replaceAll(path.sep, '/');

test('public landing and category routes share the active TerminalLayout and ObjectBrowser', () => {
  for (const route of [
    'src/pages/index.astro',
    'src/pages/notes/index.astro',
    'src/pages/tools/index.astro',
    'src/pages/dev/index.astro',
    'src/pages/blog/index.astro',
    'src/pages/friends.astro',
  ]) {
    const imports = graph.get(path.join(ROOT, route))?.map(relative) ?? [];
    assert.ok(imports.includes('src/layouts/TerminalLayout.astro'), route + ' lost TerminalLayout');
    assert.ok(
      imports.includes('src/components/terminal/ObjectBrowser.astro'),
      route + ' lost ObjectBrowser',
    );
  }
  const terminalImports = graph.get(path.join(ROOT, 'src/layouts/TerminalLayout.astro')) ?? [];
  assert.ok(terminalImports.map(relative).includes('src/layouts/BaseLayout.astro'));
});

test('public page static dependency graph does not pull in retired Dashboard or BiomeTree UI', () => {
  const roots = [...graph.keys()].filter((file) =>
    file.startsWith(path.join(SOURCE, 'pages') + path.sep),
  );
  const seen = new Set(roots);
  const stack = [...roots];
  while (stack.length) {
    const file = stack.pop()!;
    for (const imported of graph.get(file) ?? []) {
      if (seen.has(imported)) continue;
      seen.add(imported);
      stack.push(imported);
    }
  }
  for (const file of seen) {
    const name = relative(file);
    assert.ok(!name.startsWith('src/components/dashboard/'), 'Live route imports ' + name);
    assert.notEqual(name, 'src/layouts/DashboardLayout.astro');
  }
});

test('public JSON catalogs and protected Pages Functions remain distinct entry points', () => {
  for (const route of [
    'src/pages/data/notes-catalog.json.ts',
    'src/pages/data/tools-catalog.json.ts',
    'src/pages/data/terminal/[catalog].json.ts',
    'src/pages/data/system-launcher-index.json.ts',
  ]) {
    assert.ok(existsSync(path.join(ROOT, route)), 'Missing public data contract ' + route);
  }
  const middleware = readFileSync(path.join(ROOT, 'functions/api/private/_middleware.ts'), 'utf8');
  assert.match(middleware, /verifyAccessRequest\(context\.request, context\.env\)/);
  assert.match(middleware, /return await context\.next\(\)/);
});
