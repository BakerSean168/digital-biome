import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const systems = fs.readFileSync(
  path.resolve('src/components/assets/PersonalSystemsHub.astro'),
  'utf8',
);
const siteSearch = fs.readFileSync(path.resolve('src/components/common/SiteSearch.astro'), 'utf8');
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
  assert.match(systems, /Services/);
  assert.match(systems, /System Registry/);
  assert.match(systems, /Apps & Products/);
  assert.match(systems, /AI & Agents/);
  assert.match(systems, /Operations/);
  assert.match(systems, /Home Lab/);
  assert.match(systems, /data-private-link=/);
  assert.doesNotMatch(systems, /<table/);
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
  assert.match(infrastructure, /Home path/);
  assert.match(infrastructure, /Resource registry/);
  assert.match(infrastructure, /<table/);
  assert.match(infrastructure, /<details/);
  assert.doesNotMatch(infrastructure, /grid grid-cols-1 gap-6 xl:grid-cols-2/);
});

test('both system surfaces keep protected targets runtime-only', () => {
  assert.match(systems, /data-private-link=/);
  assert.match(infrastructure, /data-private-link=/);
  assert.match(infrastructure, /data-private-value=/);
  assert.doesNotMatch(systems, /\.ts\.net/);
  assert.doesNotMatch(infrastructure, /\.ts\.net/);
});

test('global Search loads the small launcher index instead of bundling infrastructure data', () => {
  assert.match(siteSearch, /\/data\/system-launcher-index\.json/);
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
