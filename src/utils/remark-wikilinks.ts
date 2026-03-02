import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Text, Parent, Link } from 'mdast';

export interface WikiLinkOptions {
  hrefTemplate?: (slug: string) => string;
  classTemplate?: (exists: boolean) => string;
}

const defaultHrefTemplate = (slug: string) => `/notes/${slug}`;
const defaultClassTemplate = (exists: boolean) => exists ? 'wikilink' : 'wikilink wikilink-broken';

export const remarkWikilinks: Plugin<[WikiLinkOptions?], Root> = (options = {}) => {
  const hrefTemplate = options.hrefTemplate ?? defaultHrefTemplate;
  const classTemplate = options.classTemplate ?? defaultClassTemplate;

  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;

      const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
      const matches = [...node.value.matchAll(wikilinkRegex)];

      if (matches.length === 0) return;

      const newNodes: (Text | Link)[] = [];
      let lastIndex = 0;

      for (const match of matches) {
        const [fullMatch, target, displayText] = match;
        const startIndex = match.index ?? 0;
        const endIndex = startIndex + fullMatch.length;

        if (startIndex > lastIndex) {
          newNodes.push({
            type: 'text',
            value: node.value.slice(lastIndex, startIndex)
          });
        }

        const slug = target.trim();
        const text = displayText ?? target;
        const href = encodeURI(hrefTemplate(slug));

        const linkNode: Link = {
          type: 'link',
          url: href,
          data: {
            hProperties: {
              className: classTemplate(true),
              'data-wikilink-target': target.trim()
            }
          },
          children: [{ type: 'text', value: text }]
        };
        newNodes.push(linkNode);

        lastIndex = endIndex;
      }

      if (lastIndex < node.value.length) {
        newNodes.push({
          type: 'text',
          value: node.value.slice(lastIndex)
        });
      }

      parent.children.splice(index, 1, ...newNodes);
    });
  };
};

export default remarkWikilinks;
