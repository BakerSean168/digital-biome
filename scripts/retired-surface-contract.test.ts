import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { SEARCH_NAVIGATION_INDEX } from '../src/config/navigation-policy';

const root = process.cwd();
const about = fs.readFileSync(path.join(root, 'src/pages/about/index.astro'), 'utf8');
const retrospective = fs.readFileSync(
  path.join(root, 'docs/refactor-retrospective-v0.1-v0.4.md'),
  'utf8',
);

test('temporary Refactor Lab is documentation-only', () => {
  assert.equal(fs.existsSync(path.join(root, 'src/pages/about/refactor.astro')), false);
  assert.doesNotMatch(about, /\/about\/refactor|REFACTOR_LAB|重构实验室/);
  assert.match(retrospective, /四轮演进/);
  assert.match(retrospective, /先量化，再重构/);
  assert.match(retrospective, /一个事实只有一个 Owner/);
});

test('Discover route is retired in favor of global Search and domain pages', () => {
  assert.equal(fs.existsSync(path.join(root, 'src/pages/discover/index.astro')), false);
  assert.equal(fs.existsSync(path.join(root, 'src/browser/discover.ts')), false);
  assert.equal(
    SEARCH_NAVIGATION_INDEX.some((item) => item.href === '/discover'),
    false,
  );
});

test('obsolete Dashboard components and layout remain absent from production source', () => {
  for (const relative of [
    'src/components/dashboard/BiomeTree.astro',
    'src/components/dashboard/BookmarkCategory.astro',
    'src/components/dashboard/BookmarkGrid.astro',
    'src/layouts/DashboardLayout.astro',
  ]) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, relative + ' is retired');
  }
});

test('obsolete Notes/Bookmark client controllers and their private transport loaders remain retired', () => {
  for (const relative of [
    'src/browser/notes-list.ts',
    'src/browser/notes-list.test.ts',
    'src/browser/bookmark-grid.ts',
    'src/browser/notes-catalog.ts',
    'src/browser/notes-catalog.test.ts',
    'src/browser/tools-catalog.ts',
    'src/browser/tools-catalog.test.ts',
  ]) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, relative + ' is retired');
  }
});

test('public Notes/Tools catalog routes and shared data owners remain available', () => {
  for (const relative of [
    'src/pages/data/notes-catalog.json.ts',
    'src/pages/data/tools-catalog.json.ts',
    'src/view-models/note-list-item.ts',
    'src/view-models/tools-catalog.ts',
    'src/repositories/bookmarks-repository.ts',
    'src/components/terminal/ObjectBrowser.astro',
  ]) {
    assert.equal(fs.existsSync(path.join(root, relative)), true, relative + ' is protected');
  }
});
