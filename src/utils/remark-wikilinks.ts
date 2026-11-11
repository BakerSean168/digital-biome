import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Text, Parent, Link } from 'mdast';
import { appendWikilinkAnchor, parseNoteWikilinks } from '../domain/note-routing';
import type { ResolveResult } from '../domain/note-routing';
import {
  getStaticNotePreview,
  resolveStaticWikilink,
  type StaticNotePreview,
} from '../domain/note-routing/static-note-catalog';

/** Keeps the per-link `data-preview-excerpt` small; ~two lines in the hover card. */
const PREVIEW_EXCERPT_MAX_CHARS = 48;

export interface WikiLinkOptions {
  resolveTarget?: (target: string) => ResolveResult;
  classTemplate?: (result: ResolveResult) => string;
  preserveUnresolved?: boolean;
  previewFor?: (noteId: string) => StaticNotePreview | undefined;
}

function previewProperties(preview: StaticNotePreview | undefined, text: string) {
  const properties: Record<string, string> = {};
  if (preview?.title && preview.title !== text) properties['data-preview-title'] = preview.title;
  const chars = Array.from(preview?.description?.trim() ?? '');
  if (chars.length > 0) {
    properties['data-preview-excerpt'] =
      chars.length > PREVIEW_EXCERPT_MAX_CHARS
        ? `${chars.slice(0, PREVIEW_EXCERPT_MAX_CHARS).join('')}…`
        : chars.join('');
  }
  return properties;
}

const defaultClassTemplate = (result: ResolveResult) =>
  result.status === 'resolved' || result.status === 'asset'
    ? 'wikilink'
    : 'wikilink wikilink-broken';

// Link URLs stay raw (unencoded) at the mdast level: the mdast->hast
// conversion percent-encodes the href once. Encoding here as well produced
// double-encoded (%25...) fragments that never match a heading id.
export const remarkWikilinks: Plugin<[WikiLinkOptions?], Root> = (options = {}) => {
  const resolveTarget = options.resolveTarget ?? resolveStaticWikilink;
  const classTemplate = options.classTemplate ?? defaultClassTemplate;
  const preserveUnresolved = options.preserveUnresolved ?? true;
  const previewFor = options.previewFor ?? getStaticNotePreview;

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
            value: node.value.slice(lastIndex, startIndex),
          });
        }

        // Same-page anchors ([[#Heading]], [[#Heading|Display]], [[#^block-id]])
        // have an empty note target: they point at a heading/block inside the
        // current note, so note resolution can never resolve them. Handle them
        // before resolution; otherwise they fall into the unresolved branch
        // below and render as raw [[...]] text.
        if (!match.target && (match.heading || match.blockRef)) {
          const samePageHref = appendWikilinkAnchor('', match);
          if (samePageHref) {
            const text =
              match.display ??
              match.heading ??
              (match.blockRef ? `^${match.blockRef}` : match.rawTarget);
            const linkNode: Link = {
              type: 'link',
              url: samePageHref,
              data: {
                hProperties: {
                  className: 'wikilink',
                  'data-wikilink-target': match.rawTarget,
                  'data-wikilink-status': 'resolved',
                },
              },
              children: [{ type: 'text', value: text }],
            };
            newNodes.push(linkNode);
            lastIndex = endIndex;
            continue;
          }
        }

        const resolution = resolveTarget(match.target);
        const text = match.display ?? match.rawTarget;

        if (
          (resolution.status === 'resolved' || resolution.status === 'asset') &&
          resolution.href
        ) {
          const linkNode: Link = {
            type: 'link',
            url: appendWikilinkAnchor(resolution.href, match),
            data: {
              hProperties: {
                className: classTemplate(resolution),
                'data-wikilink-target': match.target,
                'data-wikilink-status': resolution.status,
                ...previewProperties(
                  resolution.noteId ? previewFor(resolution.noteId) : undefined,
                  text,
                ),
              },
            },
            children: [{ type: 'text', value: text }],
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
          value: node.value.slice(lastIndex),
        });
      }

      parent.children.splice(index, 1, ...newNodes);
    });
  };
};

export default remarkWikilinks;
