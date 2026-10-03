import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const systems = fs.readFileSync(
  path.resolve('src/components/assets/PersonalSystemsHub.astro'),
  'utf8',
);
const infrastructure = fs.readFileSync(
  path.resolve('src/components/assets/InfrastructureShowcase.astro'),
  'utf8',
);

test('Personal Systems uses hierarchical rows and tables instead of a card wall', () => {
  assert.match(systems, /Quick access/);
  assert.match(systems, /System registry/);
  assert.match(systems, /<details/);
  assert.match(systems, /<table/);
  assert.match(systems, /divide-y divide-border/);
  assert.match(systems, /data-system-domain-grid/);
  assert.doesNotMatch(systems, /grid gap-3 md:grid-cols-2 xl:grid-cols-3/);
  assert.doesNotMatch(systems, /AssetSection/);
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
