/**
 * URL builders for note and asset pages.
 *
 * All href generation should go through these functions
 * instead of manual string concatenation.
 */

import type { AssetType } from '../foundation/constants';
import type { ParsedWikilink } from '../foundation/wikilink-parser';
import { slug as githubSlug } from 'github-slugger';

/**
 * Build the public href for a knowledge note.
 * Pattern: /notes/obsidian/<relative-path>
 */
export function buildKnowledgeNoteHref(noteId: string): string {
  const relPath = noteId.replace(/^obsidian\//, '');
  return `/notes/obsidian/${relPath}`;
}

/**
 * Build the public href for an asset note.
 * Pattern depends on asset_type:
 *   service -> /services/<asset_id>
 *   tool    -> /tools/<asset_id>
 *   host    -> /infrastructure/<asset_id>
 *   network -> /infrastructure/<asset_id>
 *   project -> /projects/<asset_id>
 */
export function buildAssetHref(asset: { asset_id?: string; asset_type?: AssetType }): string {
  if (!asset.asset_id || !asset.asset_type) {
    return '/';
  }

  if (asset.asset_type === 'service') {
    return `/services/${asset.asset_id}`;
  }

  if (asset.asset_type === 'tool') {
    return `/tools/${asset.asset_id}`;
  }

  if (asset.asset_type === 'project') {
    return `/projects/${asset.asset_id}`;
  }

  return `/infrastructure/${asset.asset_id}`;
}

/**
 * Build the remark plugin href template.
 * Used by remark-wikilinks to convert [[Target]] to <a href="...">.
 */
export function remarkWikilinkHrefTemplate(slug: string): string {
  return `/notes/obsidian/${slug}`;
}

function slugifyHeading(heading: string): string {
  // Must produce the same id that rehype-stable-heading-ids assigns to the
  // rendered heading: github-slugger plus trimming one trailing '-'.
  // A hand-rolled approximation diverged on headings such as
  // '2. 推荐阅读顺序 / 起点' (slugger keeps '--' where '/' was removed).
  let slug = githubSlug(heading.trim());
  if (slug.endsWith('-')) slug = slug.slice(0, -1);
  return slug;
}

export function appendWikilinkAnchor(
  href: string,
  link: Pick<ParsedWikilink, 'heading' | 'blockRef'>,
): string {
  // Returns the raw fragment: the mdast->hast conversion percent-encodes
  // link hrefs once, so encoding here as well produced double-encoded
  // (%25...) fragments that never match a heading id.
  if (link.blockRef) {
    return `${href}#^${link.blockRef}`;
  }

  if (link.heading) {
    const anchor = slugifyHeading(link.heading);
    return anchor ? `${href}#${anchor}` : href;
  }

  return href;
}
