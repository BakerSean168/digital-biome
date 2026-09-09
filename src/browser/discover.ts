import type { PagefindResultData } from './pagefind';
import { stripMarkupToText } from './strip-markup';

export type DiscoverScope = 'all' | 'assets' | 'notes';

export interface DiscoverItem {
  id: string;
  scope: DiscoverScope;
  kind: string;
  label: string;
  title: string;
  description: string;
  tags: string[];
  href: string;
}

export interface DiscoverAssetResult extends DiscoverItem {
  scope: 'assets';
}

export interface DiscoverDataIsland {
  readonly textContent: string | null;
  readonly content?: Readonly<{ textContent: string | null }>;
}

const DISCOVER_DATA_PREFIX = 'discover-json-v1:';

export function serializeDiscoverAssetResults(results: readonly unknown[]): string {
  return `${DISCOVER_DATA_PREFIX}${encodeURIComponent(JSON.stringify(results))}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}

function isAssetResult(value: unknown): value is DiscoverAssetResult {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.scope === 'assets'
    && typeof value.kind === 'string'
    && typeof value.label === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && isStringArray(value.tags)
    && typeof value.href === 'string';
}

export function parseDiscoverAssetResults(serialized: string | null): DiscoverAssetResult[] {
  if (!serialized) return [];

  try {
    const source = serialized.startsWith(DISCOVER_DATA_PREFIX)
      ? decodeURIComponent(serialized.slice(DISCOVER_DATA_PREFIX.length))
      : serialized;
    const parsed: unknown = JSON.parse(source);
    return Array.isArray(parsed) ? parsed.filter(isAssetResult) : [];
  } catch (error) {
    console.error('Unable to read Discover asset data.', error);
    return [];
  }
}

export function readDiscoverAssetResults(island: DiscoverDataIsland | null): DiscoverAssetResult[] {
  const serialized = island?.content?.textContent ?? island?.textContent ?? null;
  return parseDiscoverAssetResults(serialized);
}

export function filterDiscoverAssetResults(
  assetResults: readonly DiscoverAssetResult[],
  query: string,
  scope: DiscoverScope,
): DiscoverAssetResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  return assetResults.filter(item => {
    const matchesScope = scope === 'all' || item.scope === scope;
    const haystack = [item.title, item.description, item.id, ...item.tags]
      .join(' ')
      .toLowerCase();
    return matchesScope && haystack.includes(normalizedQuery);
  });
}

export function normalizeDiscoverHref(href: string): string {
  try {
    const url = new URL(href, 'https://discover.invalid');
    const path = url.pathname.replace(/\/+$/, '');
    return path || '/';
  } catch {
    return href.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  }
}

export function toDiscoverResult(
  item: PagefindResultData,
  assetResults: readonly DiscoverAssetResult[] = [],
): DiscoverItem | null {
  const normalizedHref = normalizeDiscoverHref(item.url);
  const asset = assetResults.find(result => normalizeDiscoverHref(result.href) === normalizedHref);
  const isNote = normalizedHref.startsWith('/notes/');
  if (!asset && !isNote) return null;

  const label = asset?.label || 'note';
  const scope: DiscoverScope = asset ? 'assets' : 'notes';
  const fallbackTitle = normalizedHref.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Untitled';
  return {
    id: item.url,
    scope,
    kind: asset?.kind || label,
    label,
    title: item.meta.title || asset?.title || fallbackTitle,
    description: stripMarkupToText(item.excerpt),
    tags: asset?.tags || [],
    href: item.url,
  };
}
