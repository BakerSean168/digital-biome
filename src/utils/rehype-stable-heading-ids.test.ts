import assert from 'node:assert/strict';
import test from 'node:test';
import type { Element, Root } from 'hast';
import { unified } from 'unified';
import { rehypeStableHeadingIds } from './rehype-stable-heading-ids';

const heading = (tagName: string, ...children: Element['children']): Element => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});
const text = (value: string) => ({ type: 'text' as const, value });

test('keeps pre-Astro-6 heading IDs: trailing hyphen trimmed, duplicates and explicit IDs kept', () => {
  const explicit = heading('h2', text('Custom'));
  explicit.properties.id = 'custom-anchor';
  const tree: Root = {
    type: 'root',
    children: [
      heading('h2', text('Vary:')),
      heading('h3', text('200 OK '), heading('code', text('<Picture />'))),
      heading('h2', text('Vary:')),
      heading('h2', text('非捕获组 (?:)')),
      explicit,
      { type: 'element', tagName: 'p', properties: {}, children: [text('Vary:')] },
    ],
  };
  unified().use(rehypeStableHeadingIds).runSync(tree);
  const ids = tree.children.map((node) => (node as Element).properties.id);
  assert.deepEqual(ids, [
    'vary',
    '200-ok-picture',
    'vary-1',
    '非捕获组',
    'custom-anchor',
    undefined,
  ]);
});
