import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

test('SiteSearch Astro markup owns only its dialog structure and one controller startup', () => {
  const astro = read('src/components/common/SiteSearch.astro');
  assert.match(astro, /id="search-modal"/);
  assert.match(astro, /id="cmd-input"/);
  assert.match(astro, /initSiteSearch\(\)/);
  assert.doesNotMatch(astro, /createSearchIntentScheduler|searchPagefind|fetch\(/);
  assert.ok(astro.split('\n').length < 75, 'SiteSearch.astro should remain a small template');
});

test('search behavior and data access have separate browser module owners', () => {
  const controller = read('src/browser/site-search-controller.ts');
  const services = read('src/browser/site-search-services.ts');
  const privateAdapter = read('src/browser/site-search-private.ts');
  const privateAccess = read('src/browser/private-access.ts');
  const results = read('src/browser/site-search-results.ts');
  assert.match(controller, /export function initSiteSearch/);
  assert.match(controller, /createSearchIntentScheduler/);
  assert.match(controller, /WeakMap/);
  assert.match(services, /\/data\/system-launcher-index\.json/);
  assert.doesNotMatch(services, /\/api\/private\/infrastructure/);
  assert.match(privateAdapter, /fetchPrivateInfrastructure/);
  assert.match(privateAccess, /\/api\/private\/infrastructure/);
  assert.match(privateAccess, /redirect: 'manual'/);
  assert.match(results, /matchSearchPalette/);
  assert.match(results, /toSearchResult/);
});
