import type { CollectionEntry } from 'astro:content';
import type { Visibility, AssetType } from '../domain/foundation/constants';

// Re-export primitive type aliases from foundation (single source of truth)
export type { Visibility, AssetType };

export type AssetRole = 'ops' | 'product' | 'showcase' | 'portal';
export type HomepageSection = 'services' | 'projects' | 'tools';

export interface AssetLink {
  label: string;
  url: string;
  kind?: 'app' | 'admin' | 'repo' | 'docs' | 'monitor' | 'panel' | 'ssh' | 'other';
  description?: string;
  visibility?: Visibility;
}

export interface AssetMonitor {
  provider?: 'nezha' | 'uptime-kuma' | 'none';
  url?: string;
  target_id?: string;
  label?: string;
}

export interface HomepageConfig {
  enabled?: boolean;
  section?: HomepageSection;
  featured?: boolean;
  order?: number;
  label?: string;
  description?: string;
}

export interface Note {
  id: string;
  slug: string;
  title: string;
  description?: string;
  content: string;
  tags: string[];
  url?: string;
  draft: boolean;
  private: boolean;
  category?: string;
  aliases: string[];
  type: 'note' | 'resource' | 'tool' | 'article';
  visibility?: Visibility;
  created?: Date;
  updated?: Date;
  icon?: string;
  rating?: number;
  platform?: string;
  pricing?: 'free' | 'freemium' | 'paid' | 'subscription';
  status?: 'active' | 'planned' | 'archived' | 'deprecated';
  lastModified?: Date;
  isBookmark: boolean;
  categories: string[];
  asset_id?: string;
  asset_type?: AssetType;
  asset_role?: AssetRole;
  host_asset_id?: string;
  parent_asset_id?: string;
  homepage?: HomepageConfig;
  monitor?: AssetMonitor;
  links?: AssetLink[];
}

export interface Bookmark {
  title: string;
  url: string;
  description?: string;
  categories: string[];
  icon?: string;
  slug: string;
}

export interface AssetCard {
  assetId: string;
  assetType: AssetType;
  assetRole?: AssetRole;
  title: string;
  description?: string;
  href: string;
  tags: string[];
  icon?: string;
  status?: string;
  homepage?: HomepageConfig;
  monitor?: AssetMonitor;
  links: AssetLink[];
}

export interface Category {
  name: string;
  slug: string;
  count: number;
}

export interface NoteLink {
  target: string;
  displayText: string;
  exists: boolean;
}

export type NoteCollectionEntry = Omit<CollectionEntry<'notes'>, 'data'> & {
  data: Omit<CollectionEntry<'notes'>['data'], 'title'> & {
    title: string;
  };
};

export type AssetNoteEntry = Omit<NoteCollectionEntry, 'data'> & {
  data: NoteCollectionEntry['data'] & {
    asset_id: string;
    asset_type: AssetType;
  };
};

// Re-export separated data contracts
export type { AssetNoteData } from './asset';

/**
 * Narrow a NoteCollectionEntry to an AssetNoteEntry.
 * An asset must have both `asset_id` and `asset_type` present,
 * OR live under the obsidian/assets/ path prefix.
 */
export function isAssetNoteData(
  data: NoteCollectionEntry['data']
): data is AssetNoteEntry['data'] {
  return Boolean(data.asset_id && data.asset_type);
}

/**
 * Check whether a collection entry is a knowledge note (not an asset).
 * A knowledge note is any note that is NOT an asset.
 */
export function isKnowledgeNoteData(
  data: NoteCollectionEntry['data']
): boolean {
  return !isAssetNoteData(data);
}
