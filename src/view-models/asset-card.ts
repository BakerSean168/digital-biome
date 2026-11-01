/**
 * Asset card view-model — transforms note entries into AssetCard for rendering.
 */

import type {
  AssetCard,
  AssetRole,
  AssetNoteEntry,
  NoteCollectionEntry,
  AssetLink,
  AssetMonitor,
} from '../types/notes';
import { buildAssetHref } from '../domain/note-routing';

/** Infer asset role from tags and homepage config when not explicitly set. */
export function inferAssetRole(
  note: Pick<NoteCollectionEntry['data'], 'asset_role' | 'asset_type' | 'homepage' | 'tags'>,
): AssetRole | undefined {
  if (note.asset_role) return note.asset_role;

  const tags = new Set(note.tags || []);

  if (tags.has('tech/personal-site')) return 'showcase';
  if (tags.has('tech/product')) return 'product';
  if (tags.has('tech/dashboard')) return 'portal';
  if (note.homepage?.section === 'projects') return 'showcase';
  if (note.asset_type === 'service') return 'ops';

  return undefined;
}

/** Transform a note entry into an AssetCard view-model. */
export function toAssetCard(note: AssetNoteEntry): AssetCard {
  return {
    assetId: note.data.asset_id,
    assetType: note.data.asset_type,
    assetRole: inferAssetRole(note.data),
    title: note.data.title,
    description: note.data.description,
    href: buildAssetHref(note.data),
    tags: note.data.tags || [],
    icon: note.data.icon,
    status: note.data.status,
    homepage: note.data.homepage,
    monitor: note.data.monitor,
    links: note.data.links || [],
  };
}

/** One policy shared by asset detail/preview surfaces; private never falls back to a raw URL. */
export function isProtectedAssetLink(link: AssetLink): boolean {
  return link.visibility === 'internal' || link.visibility === 'private';
}

/** Preserve the original monitor fallback and owner-only private_ref precedence. */
export function resolveAssetMonitorTarget(
  links: readonly AssetLink[],
  monitor?: AssetMonitor,
): { href: string | undefined; privateRef: string | undefined } {
  const link = links.find((item) => item.kind === 'monitor' || item.kind === 'panel');
  return {
    href: monitor?.url ?? (!link || isProtectedAssetLink(link) ? undefined : link.url),
    privateRef: link && isProtectedAssetLink(link) ? link.private_ref : undefined,
  };
}
