import type { Element, ElementContent, Root, Text } from 'hast';
import { render } from 'pele';
import { visit } from 'unist-util-visit';

/**
 * Rehype plugin: render fenced ```mermaid code blocks as diagrams at build
 * time with Pele (a Mermaid-syntax renderer that produces SVG strings
 * without a DOM), and inline the SVG into the page.
 *
 * Each block becomes a <div class="mermaid-diagram"> wrapping the rendered
 * SVG. The SVG carries no element ids, so any number of diagrams can share
 * a page, and it is themed through --pele-* CSS variables (see
 * src/styles/reading.css). A block Pele cannot parse keeps its source in a
 * <pre class="mermaid-source"> inside a .mermaid-source-only container, so
 * a broken diagram degrades to a readable code block instead of failing
 * the build.
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

function diagramContainer(source: string): Element {
  try {
    const { svg } = render(source);
    // hast's raw node kind is not in this @types/hast version's exports;
    // the serializer Astro uses emits it verbatim, which is what we need
    // for an already-rendered SVG string.
    const rawSvg = { type: 'raw', value: svg } as unknown as ElementContent;
    return {
      type: 'element',
      tagName: 'div',
      properties: { className: ['mermaid-diagram'] },
      children: [rawSvg],
    };
  } catch (error) {
    console.warn(
      `rehype-mermaid-diagrams: keeping source for an unrenderable diagram (${source.split('\n')[0]}): ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
    );
    const sourceText: Text = { type: 'text', value: source };
    const sourcePre: Element = {
      type: 'element',
      tagName: 'pre',
      properties: { className: ['mermaid-source'] },
      children: [sourceText],
    };
    return {
      type: 'element',
      tagName: 'div',
      properties: { className: ['mermaid-diagram', 'mermaid-source-only'] },
      children: [sourcePre],
    };
  }
}

export default function rehypeMermaidDiagrams() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return;
      const source = mermaidSourceFromPre(node);
      if (source === null) return;
      parent.children[index] = diagramContainer(source);
    });
  };
}
