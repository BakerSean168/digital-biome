import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const buildIndexes = fs.readFileSync('scripts/sync/build-indexes.ts', 'utf8');
const staticCatalog = fs.readFileSync('src/domain/note-routing/static-note-catalog.ts', 'utf8');
const sourceAdapter = fs.readFileSync('scripts/sync/source-adapter.ts', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
  devDependencies?: Record<string, string>;
};

test('frontmatter consumers share the full-YAML adapter instead of local line scanners', () => {
  assert.match(buildIndexes, /domain\/markdown\/frontmatter/);
  assert.match(staticCatalog, /markdown\/frontmatter/);
  assert.match(sourceAdapter, /domain\/markdown\/frontmatter/);

  for (const [name, source] of [
    ['build-indexes', buildIndexes],
    ['static-note-catalog', staticCatalog],
  ] as const) {
    assert.doesNotMatch(source, /function\s+parseInlineList\b/, `${name} must not restore inline-list parsing`);
    assert.doesNotMatch(source, /function\s+parseFrontmatter\b/, `${name} must not restore a local YAML parser`);
    assert.doesNotMatch(source, /currentKey.*aliases|currentKey.*tags/s, `${name} must not restore line-state YAML parsing`);
  }
});

test('yaml is an explicit build dependency for the shared adapter', () => {
  assert.match(packageJson.devDependencies?.yaml ?? '', /^\^?2\./);
});
