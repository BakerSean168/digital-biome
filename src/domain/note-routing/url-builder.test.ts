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
    assert.equal(
      buildAssetHref({ asset_id: 'host-x', asset_type: 'host' }),
      '/infrastructure/host-x',
    );
    assert.equal(
      buildAssetHref({ asset_id: 'net-x', asset_type: 'network' }),
      '/infrastructure/net-x',
    );
    assert.equal(
      buildAssetHref({ asset_id: 'sub-x', asset_type: 'subscription' }),
      '/infrastructure/sub-x',
    );
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
      '/notes/obsidian/x#性能-测试',
    );
  });

  test('matches the rendered heading ids for punctuation-heavy headings', () => {
    assert.equal(
      appendWikilinkAnchor('/notes/obsidian/x', { heading: '2. 推荐阅读顺序 / 起点' } as any),
      '/notes/obsidian/x#2-推荐阅读顺序--起点',
    );
    assert.equal(
      appendWikilinkAnchor('/notes/obsidian/x', { heading: 'Vary:' } as any),
      '/notes/obsidian/x#vary',
    );
  });

  test('keeps the href when a heading slugifies to nothing', () => {
    assert.equal(
      appendWikilinkAnchor('/notes/obsidian/x', { heading: '!!!' } as any),
      '/notes/obsidian/x',
    );
  });

  test('marks block references with a caret', () => {
    assert.equal(
      appendWikilinkAnchor('/notes/obsidian/x', { blockRef: 'block-1' } as any),
      '/notes/obsidian/x#^block-1',
    );
    assert.equal(
      appendWikilinkAnchor('/notes/obsidian/x', { blockRef: 'a b' } as any),
      '/notes/obsidian/x#^a b',
    );
  });
});
