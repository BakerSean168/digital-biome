import type { Element, ElementContent, Root, Text } from 'hast';
import { visit } from 'unist-util-visit';

/**
 * Rehype plugin: turn fenced ```mermaid code blocks into diagram containers.
 *
 * The page ships a container whose <pre class="mermaid-source"> holds the
 * diagram source, styled like a normal code block. The browser renderer
 * (src/browser/mermaid-diagrams.ts) replaces it with an SVG diagram when
 * JavaScript is available; without JavaScript the source stays readable.
 *
 * Handles both the raw `pre > code.language-mermaid` shape (before syntax
 * highlighting) and the highlighted `pre[data-language="mermaid"]` shape
 * (Shiki wraps each line in a span), because source extraction only
 * concatenates text nodes, which Shiki preserves verbatim.
 */

function collectText(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(collectText).join('');
  return '';
}

function classList(element: Element): string[] {
  const className: unknown = element.properties?.className;
  if (Array.isArray(className)) return className.map(String);
  if (typeof className === 'string') return className.split(/\s+/).filter(Boolean);
  return [];
}

function mermaidSourceFromPre(pre: Element): string | null {
  const code = pre.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'code',
  );
  if (!code) return null;
  const isMermaid =
    pre.properties?.dataLanguage === 'mermaid' || classList(code).includes('language-mermaid');
  if (!isMermaid) return null;
  const source = collectText(code).replace(/\n$/, '');
  return source.trim() ? source : null;
}

export default function rehypeMermaidDiagrams() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return;
      const source = mermaidSourceFromPre(node);
      if (source === null) return;
      const sourceText: Text = { type: 'text', value: source };
      const sourcePre: Element = {
        type: 'element',
        tagName: 'pre',
        properties: { className: ['mermaid-source'] },
        children: [sourceText],
      };
      const container: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['mermaid-diagram'], dataMermaidDiagram: true },
        children: [sourcePre],
      };
      parent.children[index] = container;
    });
  };
}
