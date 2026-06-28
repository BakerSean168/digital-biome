/**
 * Foundation constants — zero external dependencies.
 *
 * This module is the single source of truth for primitive type aliases
 * and shared constants. It has NO imports from types/ or astro:content,
 * so both Astro-context modules and plain tsx scripts (like build-indexes)
 * can safely import from here.
 */

// ── Primitive type aliases ──

export type Visibility = 'public' | 'private' | 'internal';
export type AssetType = 'service' | 'tool' | 'host' | 'network';

// ── Visibility values ──

export const VISIBILITY_PUBLIC = 'public' as const;
export const VISIBILITY_PRIVATE = 'private' as const;
export const VISIBILITY_INTERNAL = 'internal' as const;

// ── Note ID path prefixes ──

/** Canonical prefix for all note IDs: `obsidian/` */
export const NOTE_ID_PREFIX = 'obsidian/';

/** Prefix for asset note IDs: `obsidian/assets/` */
export const ASSET_NOTE_PREFIX = 'obsidian/assets/';

/** Slug for the dashboard resource types config note. */
export const CONFIG_RESOURCE_TYPES_SLUG = 'obsidian/config/dashboard-resource-types';

// ── Sorting / collation ──

/** Default locale for string comparison in sort operations. */
export const COLLATION_LOCALE = 'zh-CN';

/** Default order value for homepage items when none is specified. */
export const DEFAULT_HOMEPAGE_ORDER = 100;

// ── Git log parsing ──

/** Marker prefix used to delimit timestamps in git log output. */
export const GIT_TS_MARKER = '__TS__';

// ── File system paths ──

/** Root directory for synced Obsidian markdown files (relative to project root). */
export const OBSIDIAN_NOTES_DIR = 'src/data/obsidian';
