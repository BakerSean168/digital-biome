import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { inferAssetRole, toAssetCard } from './asset-card';
import type { NoteCollectionEntry } from '../types/notes';

function noteData(data: Record<string, unknown> = {}) {
  return data as unknown as NoteCollectionEntry['data'];
}

describe('inferAssetRole', () => {
  test('honors the explicit asset_role when present', () => {
    assert.equal(inferAssetRole(noteData({ asset_role: 'product' })), 'product');
    assert.equal(
      inferAssetRole(noteData({ asset_role: 'portal', tags: ['tech/personal-site'] })),
      'portal',
    );
  });

  test('infers from tags', () => {
    assert.equal(inferAssetRole(noteData({ tags: ['tech/personal-site'] })), 'showcase');
    assert.equal(inferAssetRole(noteData({ tags: ['tech/product'] })), 'product');
    assert.equal(inferAssetRole(noteData({ tags: ['tech/dashboard'] })), 'portal');
  });

  test('infers showcase from the projects homepage section', () => {
    assert.equal(
      inferAssetRole(noteData({ homepage: { section: 'projects' } })),
      'showcase',
    );
  });

  test('defaults services to ops and everything else to undefined', () => {
    assert.equal(inferAssetRole(noteData({ asset_type: 'service' })), 'ops');
    assert.equal(inferAssetRole(noteData({ asset_type: 'host' })), undefined);
    assert.equal(inferAssetRole(noteData({})), undefined);
  });
});

describe('toAssetCard', () => {
  test('maps a note entry to its card with a routed href', () => {
    const entry = {
      id: 'obsidian/assets/services/home',
      data: {
        asset_id: 'svc-home',
        asset_type: 'service',
        title: 'Home Dashboard',
        description: 'dash',
        tags: ['tech/dashboard'],
        icon: 'gauge',
        status: 'active',
        homepage: { section: 'services' },
        monitor: { provider: 'nezha' },
        links: [{ label: 'Open', url: 'https://example.com' }],
      },
    } as unknown as NoteCollectionEntry;

    assert.deepEqual(toAssetCard(entry), {
      assetId: 'svc-home',
      assetType: 'service',
      assetRole: 'portal',
      title: 'Home Dashboard',
      description: 'dash',
      href: '/services/svc-home',
      tags: ['tech/dashboard'],
      icon: 'gauge',
      status: 'active',
      homepage: { section: 'services' },
      monitor: { provider: 'nezha' },
      links: [{ label: 'Open', url: 'https://example.com' }],
    });
  });

  test('defaults tags and links to empty arrays', () => {
    const entry = {
      id: 'obsidian/assets/tools/x',
      data: { asset_id: 'tool-x', asset_type: 'tool', title: 'X' },
    } as unknown as NoteCollectionEntry;

    const card = toAssetCard(entry);
    assert.deepEqual(card.tags, []);
    assert.deepEqual(card.links, []);
    assert.equal(card.href, '/tools/tool-x');
  });
});
