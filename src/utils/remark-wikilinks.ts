import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Text, Parent, Link } from 'mdast';
import { appendWikilinkAnchor, parseNoteWikilinks } from '../domain/note-routing';
import type { ResolveResult } from '../domain/note-routing';
import { resolveStaticWikilink } from '../domain/note-routing/static-note-catalog';

export interface WikiLinkOptions {
  notesRoot?: string;
  resolveTarget?: (target: string) => ResolveResult;
  classTemplate?: (result: ResolveResult) => string;
  preserveUnresolved?: boolean;
}

const defaultClassTemplate = (result: ResolveResult) =>
  result.status === 'resolved' || result.status === 'asset'
    ? 'wikilink'
    : 'wikilink wikilink-broken';

export const remarkWikilinks: Plugin<[WikiLinkOptions?], Root> = (options = {}) => {
  const resolveTarget = options.resolveTarget ?? ((target: string) => resolveStaticWikilink(target, options.notesRoot));
  const classTemplate = options.classTemplate ?? defaultClassTemplate;
  const preserveUnresolved = options.preserveUnresolved ?? true;

  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;

      const matches = parseNoteWikilinks(node.value);
      if (matches.length === 0) return;

      const newNodes: (Text | Link)[] = [];
      let lastIndex = 0;

      for (const match of matches) {
        const startIndex = match.startIndex;
        const endIndex = startIndex + match.length;

        if (startIndex > lastIndex) {
          newNodes.push({
            type: 'text',
            value: node.value.slice(lastIndex, startIndex)
          });
        }

        const resolution = resolveTarget(match.target);
        const text = match.display ?? match.rawTarget;

        if ((resolution.status === 'resolved' || resolution.status === 'asset') && resolution.href) {
          const linkNode: Link = {
            type: 'link',
            url: encodeURI(appendWikilinkAnchor(resolution.href, match)),
            data: {
              hProperties: {
                className: classTemplate(resolution),
                'data-wikilink-target': match.target,
                'data-wikilink-status': resolution.status,
              }
            },
            children: [{ type: 'text', value: text }]
          };
          newNodes.push(linkNode);
        } else {
          newNodes.push({
            type: 'text',
            value: preserveUnresolved ? node.value.slice(startIndex, endIndex) : text,
          });
        }

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
