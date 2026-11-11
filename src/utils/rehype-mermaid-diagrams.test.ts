import assert from 'node:assert/strict';
import test from 'node:test';
import type { Element, Root } from 'hast';
import rehypeMermaidDiagrams from './rehype-mermaid-diagrams';

function codeBlock(language: string, source: string): Element {
  return {
    type: 'element',
    tagName: 'pre',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: { className: [`language-${language}`] },
        children: [{ type: 'text', value: source }],
      },
    ],
  };
}

function rootWith(...children: Element[]): Root {
  return { type: 'root', children };
}

test('turns a mermaid fence into a diagram container holding the source', () => {
  const tree = rootWith(codeBlock('mermaid', 'flowchart LR\n  A --> B\n'));
  rehypeMermaidDiagrams()(tree);
  const container = tree.children[0] as Element;
  assert.equal(container.tagName, 'div');
  assert.deepEqual(container.properties?.className, ['mermaid-diagram']);
  assert.equal(container.properties?.dataMermaidDiagram, true);
  const sourcePre = container.children[0] as Element;
  assert.equal(sourcePre.tagName, 'pre');
  assert.deepEqual(sourcePre.properties?.className, ['mermaid-source']);
  assert.deepEqual(sourcePre.children[0], { type: 'text', value: 'flowchart LR\n  A --> B' });
});

test('leaves other code fences untouched', () => {
  const block = codeBlock('ts', 'const answer = 42;\n');
  const tree = rootWith(block);
  rehypeMermaidDiagrams()(tree);
  assert.equal(tree.children[0], block);
});

test('leaves an empty mermaid fence untouched', () => {
  const block = codeBlock('mermaid', '');
  const tree = rootWith(block);
  rehypeMermaidDiagrams()(tree);
  assert.equal(tree.children[0], block);
});

test('extracts the source from a Shiki-highlighted block (line spans)', () => {
  const lineSpan = (text: string): Element => ({
    type: 'element',
    tagName: 'span',
    properties: { className: ['line'] },
    children: [{ type: 'text', value: text }],
  });
  const tree = rootWith({
    type: 'element',
    tagName: 'pre',
    properties: { className: ['astro-code'], dataLanguage: 'mermaid' },
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: {},
        children: [
          lineSpan('flowchart LR'),
          { type: 'text', value: '\n' },
          lineSpan('  A --> B'),
          { type: 'text', value: '\n' },
        ],
      },
    ],
  });
  rehypeMermaidDiagrams()(tree);
  const container = tree.children[0] as Element;
  assert.equal(container.tagName, 'div');
  assert.deepEqual(container.properties?.className, ['mermaid-diagram']);
  const sourcePre = container.children[0] as Element;
  assert.equal(sourcePre.tagName, 'pre');
  assert.deepEqual(sourcePre.children[0], { type: 'text', value: 'flowchart LR\n  A --> B' });
});
