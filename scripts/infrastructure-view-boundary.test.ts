import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (name: string): string => fs.readFileSync(path.resolve(name), 'utf8');

test('only current infrastructure and asset detail routes remain as view entrypoints', () => {
  for (const legacy of [
    'InfrastructureAtlas.astro',
    'InfrastructureNodePanel.astro',
    'AssetSection.astro',
    'AssetCard.astro',
    'ProjectCard.astro',
  ]) {
    assert.equal(fs.existsSync(path.resolve('src/components/assets', legacy)), false, legacy);
  }
  assert.match(read('src/pages/infrastructure/index.astro'), /InfrastructureShowcase/);
  assert.match(read('src/pages/infrastructure/[assetId].astro'), /InfrastructureKindIcon/);
  assert.match(read('src/components/assets/AssetDetailView.astro'), /resolveAssetMonitorTarget/);
  assert.match(read('src/components/assets/InfrastructureTopologyMap.astro'), /TopologyNodeCard/);
});

test('registry and resource detail reuse one semantic kind icon and one status owner', () => {
  const registry = read('src/components/assets/InfrastructureShowcase.astro');
  const detail = read('src/pages/infrastructure/[assetId].astro');
  const icon = read('src/components/assets/InfrastructureKindIcon.astro');
  assert.match(registry, /InfrastructureKindIcon/);
  assert.match(detail, /InfrastructureKindIcon/);
  assert.match(registry, /infrastructureStatusCode/);
  assert.match(registry, /infrastructureStatusTone/);
  assert.match(read('src/view-models/infrastructure-showcase.ts'), /infrastructureKindLabel/);
  assert.match(detail, /registeredStatus/);
  assert.match(icon, /const Icon =/);
  assert.doesNotMatch(icon, /fetch\(|data-private-link/);
});

test('protected infrastructure and asset detail URLs remain unlocked only by existing Access consumer', () => {
  const registry = read('src/components/assets/InfrastructureShowcase.astro');
  const detail = read('src/pages/infrastructure/[assetId].astro');
  const asset = read('src/components/assets/AssetDetailView.astro');
  assert.match(registry, /data-private-link=/);
  assert.match(registry, /data-private-value=/);
  assert.match(detail, /data-private-link=/);
  assert.match(detail, /data-private-value=/);
  assert.match(detail, /data-private-link-value=/);
  assert.match(asset, /data-private-link=/);
  assert.match(asset, /isProtectedAssetLink/);
  assert.doesNotMatch(registry + detail + asset, /\.ts\.net/);
});
