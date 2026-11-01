import GithubSlugger from 'github-slugger';
import type { Element, Root } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

const HEADING = /^h[1-6]$/;
const CODE_TAGS = new Set(['code', 'pre']);

/**
 * Keeps the Markdown heading IDs published before Astro 6.
 *
 * Astro 6 stopped trimming the trailing `-` that github-slugger leaves on headings
 * ending in punctuation (`## Vary:` became `#vary-` instead of `#vary`). Note
 * anchors are a public contract (TOC links, Wikilink `[[note#heading]]` anchors from
 * `appendWikilinkAnchor`, and external deep links), so this plugin reproduces the
 * Astro 5 `.md` heading-ID algorithm. Astro's own `rehypeHeadingIds` keeps an
 * existing `id` and still collects `headings` for the table of contents.
 */
export const rehypeStableHeadingIds: Plugin<[], Root> = () => (tree) => {
  const slugger = new GithubSlugger();
  visit(tree, 'element', (node: Element) => {
    if (!HEADING.test(node.tagName) || typeof node.properties.id === 'string') return;
    let text = '';
    visit(node, (child, _index, parent) => {
      if (!parent || child.type === 'element') return;
      // `raw` nodes (inline HTML) are not part of the hast core types.
      const { type, value } = child as { type: string; value?: unknown };
      if ((type !== 'text' && type !== 'raw') || typeof value !== 'string') return;
      if (type === 'raw' && /^\n?<.*>\n?$/.test(value)) return;
      const parentTag = (parent as Element).tagName;
      text += CODE_TAGS.has(parentTag) ? value : value.replace(/\{/g, '${');
    });
    let slug = slugger.slug(text);
    if (slug.endsWith('-')) slug = slug.slice(0, -1);
    node.properties.id = slug;
  });
};

export default rehypeStableHeadingIds;
