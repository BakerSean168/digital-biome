import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(path, 'utf8');
test('search exposes only infrastructure-owned services and resolves owner targets via protected Infrastructure API', () => {
  assert.match(
    read('src/pages/data/infrastructure-service-index.json.ts'),
    /getInfrastructureServiceSearchIndex/,
  );
  assert.match(read('src/browser/site-search-services.ts'), /infrastructure-service-index\.json/);
  assert.match(read('src/browser/site-search-private.ts'), /fetchPrivateInfrastructure/);
  assert.match(read('functions/api/private/infrastructure.ts'), /Cache-Control/);
  assert.match(read('functions/api/private/_middleware.ts'), /verifyAccessRequest/);
});
test('obsolete PDS routes and browser owner-catalog controller are absent', () => {
  for (const path of [
    'src/pages/systems/index.astro',
    'functions/api/private/systems.ts',
    'src/browser/owner-systems.ts',
  ])
    assert.equal(fs.existsSync(path), false, `Obsolete PDS dependency: ${path}`);
  assert.doesNotMatch(read('src/config/navigation-policy.ts'), /href: '\/systems'/);
});
