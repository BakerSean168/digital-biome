import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const pagefindSource = fs.readFileSync(path.resolve('src/browser/pagefind.ts'), 'utf8');
const siteSearch = fs.readFileSync(path.resolve('src/browser/site-search-controller.ts'), 'utf8');

test('Pagefind uses CSP-compatible dynamic import at the stable generated runtime path', () => {
  assert.doesNotMatch(pagefindSource, /new Function\(|\beval\(/);
  assert.match(pagefindSource, /import\(\/\* @vite-ignore \*\/ url\)/);
  assert.match(pagefindSource, /\/pagefind\/pagefind\.js/);
  assert.match(pagefindSource, /pagefindImportAttempt/);
});

test('Search exposes a user-initiated retry without polling or stale modal writes', () => {
  assert.match(siteSearch, /dataset\.pagefindRetry\s*=/);
  assert.match(siteSearch, /searchIntents\.start\(cmdInput\.value\)/);
  assert.match(siteSearch, /if \(!searchModal\.open/);
  assert.match(siteSearch, /if \(!token\.isCurrent\(\)\) return/);
});
