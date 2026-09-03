import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeNoteHref,
  buildAssetHref,
  remarkWikilinkHrefTemplate,
  appendWikilinkAnchor,
} from './url-builder';

describe('buildKnowledgeNoteHref', () => {
  test('maps a note id to its public URL', () => {
    assert.equal(buildKnowledgeNoteHref('obsidian/vue-computed'), '/notes/obsidian/vue-computed');
    assert.equal(buildKnowledgeNoteHref('obsidian/a/b/c'), '/notes/obsidian/a/b/c');
  });

  test('does not double-prefix ids without the obsidian prefix', () => {
    assert.equal(buildKnowledgeNoteHref('vue-computed'), '/notes/obsidian/vue-computed');
  });
});

describe('buildAssetHref', () => {
  test('maps each asset type to its section', () => {
    assert.equal(buildAssetHref({ asset_id: 'svc-x', asset_type: 'service' }), '/services/svc-x');
    assert.equal(buildAssetHref({ asset_id: 'tool-x', asset_type: 'tool' }), '/tools/tool-x');
    assert.equal(buildAssetHref({ asset_id: 'proj-x', asset_type: 'project' }), '/projects/proj-x');
    assert.equal(buildAssetHref({ asset_id: 'host-x', asset_type: 'host' }), '/infrastructure/host-x');
    assert.equal(buildAssetHref({ asset_id: 'net-x', asset_type: 'network' }), '/infrastructure/net-x');
    assert.equal(buildAssetHref({ asset_id: 'sub-x', asset_type: 'subscription' }), '/infrastructure/sub-x');
  });

  test('falls back to the homepage when ids are missing', () => {
    assert.equal(buildAssetHref({}), '/');
    assert.equal(buildAssetHref({ asset_id: 'x' }), '/');
    assert.equal(buildAssetHref({ asset_type: 'service' }), '/');
  });
});

describe('remarkWikilinkHrefTemplate', () => {
  test('builds the knowledge note href template', () => {
    assert.equal(remarkWikilinkHrefTemplate('z/note'), '/notes/obsidian/z/note');
  });
});

describe('appendWikilinkAnchor', () => {
  test('leaves hrefs without anchors unchanged', () => {
    assert.equal(appendWikilinkAnchor('/notes/obsidian/x', {}), '/notes/obsidian/x');
  });

  test('slugifies headings down to a URL fragment', () => {
    assert.equal(
      appendWikilinkAnchor('/notes/obsidian/x', { heading: 'Hello, World!' } as any),
      '/notes/obsidian/x#hello-world',
    );
    assert.equal(
      appendWikilinkAnchor('/notes/obsidian/x', { heading: '性能 测试' } as any),
      '/notes/obsidian/x#%E6%80%A7%E8%83%BD-%E6%B5%8B%E8%AF%95',
    );
  });

  test('keeps the href when a heading slugifies to nothing', () => {
    assert.equal(appendWikilinkAnchor('/notes/obsidian/x', { heading: '!!!' } as any), '/notes/obsidian/x');
  });

  test('encodes block references with the caret marker', () => {
    assert.equal(
      appendWikilinkAnchor('/notes/obsidian/x', { blockRef: 'block-1' } as any),
      '/notes/obsidian/x#%5Eblock-1',
    );
    assert.equal(
      appendWikilinkAnchor('/notes/obsidian/x', { blockRef: 'a b' } as any),
      '/notes/obsidian/x#%5Ea%20b',
    );
  });
});
