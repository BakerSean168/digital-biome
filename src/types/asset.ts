/**
 * Asset note data contract.
 *
 * Represents an infrastructure / service / tool / host / network asset.
 * Asset notes must carry `asset_id` and `asset_type`; the website URL
 * is derived from these fields, not from the file path.
 */

import type {
  AssetType,
  AssetRole,
  AssetLink,
  AssetMonitor,
  HomepageConfig,
  Visibility,
} from './notes';

export interface AssetNoteData {
  title: string;
  description: string;
  tags: string[];
  type?: 'asset';
  asset_id: string;
  asset_type: AssetType;
  visibility: Visibility;
  status?: 'active' | 'planned' | 'archived' | 'deprecated';
  asset_role?: AssetRole;
  host_asset_id?: string;
  parent_asset_id?: string;
  homepage?: HomepageConfig;
  monitor?: AssetMonitor;
  links: AssetLink[];
  aliases: string[];
  draft: boolean;
  private: boolean;
  created?: Date;
  updated?: Date;
  icon?: string;
}
