import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  inferAssetRole,
  isProtectedAssetLink,
  resolveAssetMonitorTarget,
  toAssetCard,
} from './asset-card';
import type { AssetNoteEntry, NoteCollectionEntry } from '../types/notes';

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
    assert.equal(inferAssetRole(noteData({ homepage: { section: 'projects' } })), 'showcase');
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
    } as unknown as AssetNoteEntry;

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
    } as unknown as AssetNoteEntry;

    const card = toAssetCard(entry);
    assert.deepEqual(card.tags, []);
    assert.deepEqual(card.links, []);
    assert.equal(card.href, '/tools/tool-x');
  });
});

describe('AssetDetailView protected link policy', () => {
  test('internal and private links remain locked, public and unspecified visibility stay public', () => {
    assert.equal(isProtectedAssetLink({ label: 'Private', visibility: 'private' }), true);
    assert.equal(isProtectedAssetLink({ label: 'Internal', visibility: 'internal' }), true);
    assert.equal(isProtectedAssetLink({ label: 'Public', visibility: 'public' }), false);
    assert.equal(isProtectedAssetLink({ label: 'Default' }), false);
  });

  test('monitor projection preserves existing owner-only ref and optional public monitor precedence', () => {
    const links = [
      { label: 'Control', kind: 'app' as const, url: 'https://example.test' },
      {
        label: 'Monitor',
        kind: 'monitor' as const,
        visibility: 'private' as const,
        private_ref: 'owner.monitor',
        url: 'https://must-not-leak.invalid',
      },
    ];
    assert.deepEqual(resolveAssetMonitorTarget(links), {
      href: undefined,
      privateRef: 'owner.monitor',
    });
    assert.deepEqual(resolveAssetMonitorTarget(links, { url: 'https://public-monitor.example' }), {
      href: 'https://public-monitor.example',
      privateRef: 'owner.monitor',
    });
    assert.deepEqual(
      resolveAssetMonitorTarget([
        { label: 'Monitor', kind: 'panel', url: 'https://public-monitor.example' },
      ]),
      {
        href: 'https://public-monitor.example',
        privateRef: undefined,
      },
    );
    assert.deepEqual(resolveAssetMonitorTarget([]), { href: undefined, privateRef: undefined });
  });
});
