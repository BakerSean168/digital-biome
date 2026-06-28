/**
 * Asset card view-model — transforms note entries into AssetCard for rendering.
 */

import type {
  AssetCard,
  AssetRole,
  NoteCollectionEntry,
} from '../types/notes';
import { buildAssetHref } from '../domain/note-routing';

/** Infer asset role from tags and homepage config when not explicitly set. */
export function inferAssetRole(
  note: Pick<NoteCollectionEntry['data'], 'asset_role' | 'asset_type' | 'homepage' | 'tags'>
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
export function toAssetCard(note: NoteCollectionEntry): AssetCard {
  return {
    assetId: note.data.asset_id!,
    assetType: note.data.asset_type!,
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
