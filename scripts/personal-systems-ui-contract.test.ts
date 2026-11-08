import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const systems = fs.readFileSync(
  path.resolve('src/components/assets/PersonalSystemsHub.astro'),
  'utf8',
);
const serviceDirectory = fs.readFileSync(
  path.resolve('src/components/assets/PersonalSystemsServiceDirectory.astro'),
  'utf8',
);
const siteSearch = fs.readFileSync(path.resolve('src/components/common/SiteSearch.astro'), 'utf8');
const searchServices = fs.readFileSync(path.resolve('src/browser/site-search-services.ts'), 'utf8');
const privateUnlock = fs.readFileSync(
  path.resolve('src/components/common/PrivateInfrastructureUnlock.astro'),
  'utf8',
);
const launcherIndex = fs.readFileSync(
  path.resolve('src/pages/data/system-launcher-index.json.ts'),
  'utf8',
);
const infrastructureDetail = fs.readFileSync(
  path.resolve('src/pages/infrastructure/[assetId].astro'),
  'utf8',
);
const infrastructure = fs.readFileSync(
  path.resolve('src/components/assets/InfrastructureShowcase.astro'),
  'utf8',
);

test('Personal Systems is a launcher, not a dashboard or card wall', () => {
  assert.match(systems, /Pinned/);
  assert.match(systems, /Servers/);
  assert.match(serviceDirectory, /Services/);
  assert.match(systems, /PersonalSystemsServiceDirectory/);
  assert.match(systems, /System Registry/);
  assert.match(serviceDirectory, /Apps & Products/);
  assert.match(serviceDirectory, /AI & Agents/);
  assert.match(serviceDirectory, /Operations/);
  assert.match(serviceDirectory, /Home Lab/);
  assert.match(systems, /data-private-link=/);
  assert.match(serviceDirectory, /data-private-link=/);
  assert.doesNotMatch(systems, /<table/);
  assert.doesNotMatch(serviceDirectory, /<table/);
  assert.doesNotMatch(systems, /Active services/);
  assert.doesNotMatch(systems, /Projections/);
  assert.doesNotMatch(systems, /grid gap-3 md:grid-cols-2 xl:grid-cols-3/);
});

test('resolved private launcher targets open externally by default', () => {
  assert.match(privateUnlock, /target\.target = '_blank'/);
  assert.match(privateUnlock, /target\.rel = 'noopener noreferrer'/);
});

test('Infrastructure prioritizes topology then compact registry', () => {
  const topology = infrastructure.indexOf('Topology');
  const inventory = infrastructure.indexOf('Inventory');
  assert.ok(topology >= 0, 'Infrastructure page should expose a topology section');
  assert.ok(inventory > topology, 'Resource inventory should follow topology, not precede it');
  assert.match(infrastructure, /Public fleet/);
  assert.match(infrastructure, /家庭链路/);
  assert.match(infrastructure, /资源清单/);
  assert.match(infrastructure, /<table/);
  assert.match(infrastructure, /<details/);
  assert.doesNotMatch(infrastructure, /grid grid-cols-1 gap-6 xl:grid-cols-2/);
});

test('both system surfaces keep protected targets runtime-only', () => {
  assert.match(systems, /data-private-link=/);
  assert.match(serviceDirectory, /data-private-link=/);
  assert.match(infrastructure, /data-private-link=/);
  assert.match(infrastructure, /data-private-value=/);
  assert.doesNotMatch(systems, /\.ts\.net/);
  assert.doesNotMatch(serviceDirectory, /\.ts\.net/);
  assert.doesNotMatch(infrastructure, /\.ts\.net/);
});

test('global Search loads the small launcher index instead of bundling infrastructure data', () => {
  assert.match(searchServices, /\/data\/system-launcher-index\.json/);
  assert.match(siteSearch, /initSiteSearch/);
  assert.doesNotMatch(siteSearch, /from ['"]\.\.\/\.\.\/utils\/personal-systems/);
  assert.match(launcherIndex, /getPortalServiceSearchIndex/);
});

test('Infrastructure detail keeps entrypoints prominent without returning to a card wall', () => {
  assert.match(infrastructureDetail, /Entrypoints/);
  assert.match(infrastructureDetail, /Facts/);
  assert.match(infrastructureDetail, /Relationships/);
  assert.match(infrastructureDetail, /data-private-link=/);
  assert.match(infrastructureDetail, /data-private-value=/);
  assert.match(infrastructureDetail, /data-private-link-value=/);
  assert.doesNotMatch(infrastructureDetail, /rounded-\[28px\]/);
  assert.doesNotMatch(infrastructureDetail, /bg-card\/70/);
  assert.doesNotMatch(infrastructureDetail, /\bgetInfrastructureResource\b/);
  assert.doesNotMatch(infrastructureDetail, /Layers3/);
});

test('lifecycle filter remains contained in the service directory and defaults active', () => {
  assert.match(serviceDirectory, /SERVICE_LIFECYCLE_FILTERS/);
  assert.match(serviceDirectory, /data-service-filter-root/);
  assert.match(serviceDirectory, /data-service-category-section/);
  assert.match(serviceDirectory, /data-service-row/);
  assert.match(serviceDirectory, /initializeServiceStatusFilters/);
  assert.match(serviceDirectory, /option.id === 'active'/);
  assert.doesNotMatch(systems, /data-service-filter-root/);
});
