import assert from 'node:assert/strict';
import test from 'node:test';
import type { Link, Root, Text } from 'mdast';
import { unified } from 'unified';
import { remarkWikilinks } from './remark-wikilinks';
import type { ResolveResult } from '../domain/note-routing';

const resolveTarget = (target: string): ResolveResult =>
  target === 'Known Note'
    ? { status: 'resolved', noteId: 'obsidian/known-note', href: '/notes/obsidian/known-note' }
    : { status: 'missing' };

function run(value: string): (Text | Link)[] {
  const tree: Root = {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value }] }],
  };
  unified()
    .use(remarkWikilinks, { resolveTarget, previewFor: () => undefined })
    .runSync(tree);
  const paragraph = tree.children[0];
  assert.equal(paragraph.type, 'paragraph');
  return paragraph.type === 'paragraph' ? (paragraph.children as (Text | Link)[]) : [];
}

function linkTexts(nodes: (Text | Link)[]): string[] {
  return nodes.map((node) =>
    node.type === 'link' ? (node.children[0] as Text).value : node.value,
  );
}

test('same-page heading link with alias becomes an in-page anchor', () => {
  const nodes = run(
    '先看 [[#从离线账号开始：本地数据不能被一次登录替换|先让桌面端离线工作]] 再看正文',
  );
  assert.deepEqual(linkTexts(nodes), ['先看 ', '先让桌面端离线工作', ' 再看正文']);
  const link = nodes[1] as Link;
  assert.equal(link.type, 'link');
  assert.equal(link.url, '#从离线账号开始本地数据不能被一次登录替换');
  const properties = (link.data as { hProperties?: Record<string, unknown> } | undefined)
    ?.hProperties;
  assert.equal(properties?.className, 'wikilink');
  assert.equal(properties?.['data-wikilink-status'], 'resolved');
});

test('same-page heading link without alias displays the heading text', () => {
  const nodes = run('[[#基础理论]]');
  assert.equal(nodes.length, 1);
  const link = nodes[0] as Link;
  assert.equal(link.type, 'link');
  assert.equal(link.url, '#基础理论');
  assert.deepEqual(linkTexts(nodes), ['基础理论']);
});

test('same-page block reference becomes an in-page anchor', () => {
  const nodes = run('[[#^block-1]]');
  const link = nodes[0] as Link;
  assert.equal(link.type, 'link');
  assert.equal(link.url, '#^block-1');
  assert.deepEqual(linkTexts(nodes), ['^block-1']);
});

test('several same-page links in one paragraph are all converted', () => {
  const nodes = run('- [[#简介]]\n- [[#主要内容|正文]]\n- [[#总结]]');
  const links = nodes.filter((node) => node.type === 'link');
  assert.equal(links.length, 3);
  assert.deepEqual(linkTexts(nodes), ['- ', '简介', '\n- ', '正文', '\n- ', '总结']);
});

test('same-page heading that slugifies to nothing stays raw text', () => {
  const nodes = run('[[#!!!|别名]]');
  assert.deepEqual(nodes, [{ type: 'text', value: '[[#!!!|别名]]' }]);
});

test('cross-note heading links still resolve through the note catalog', () => {
  const nodes = run('[[Known Note#性能 测试|别名]]');
  const link = nodes[0] as Link;
  assert.equal(link.type, 'link');
  assert.equal(link.url, '/notes/obsidian/known-note#性能-测试');
  assert.deepEqual(linkTexts(nodes), ['别名']);
});

test('unresolved note links are still preserved as raw text', () => {
  const nodes = run('[[Missing Note]]');
  assert.deepEqual(nodes, [{ type: 'text', value: '[[Missing Note]]' }]);
});
