/**
 * URL builders for note and asset pages.
 *
 * All href generation should go through these functions
 * instead of manual string concatenation.
 */

import type { AssetType } from '../foundation/constants';
import type { ParsedWikilink } from '../foundation/wikilink-parser';

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
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\p{Mark}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function appendWikilinkAnchor(href: string, link: Pick<ParsedWikilink, 'heading' | 'blockRef'>): string {
  if (link.blockRef) {
    return `${href}#%5E${encodeURIComponent(link.blockRef)}`;
  }

  if (link.heading) {
    const anchor = slugifyHeading(link.heading);
    return anchor ? `${href}#${encodeURIComponent(anchor)}` : href;
  }

  return href;
}
