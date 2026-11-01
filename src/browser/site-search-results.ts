import type { SearchNavigationCommand } from '../config/navigation-policy';
import type { PagefindResultData } from './pagefind';
import { stripMarkupToText } from './strip-markup';

export type ServiceResult = {
  type: 'service';
  label: 'SVC';
  title: string;
  desc: string;
  href: string;
  aliases: string[];
  privateRef?: string;
  pinned: boolean;
};

export type SearchResult = {
  type: 'search';
  label: string;
  title: string;
  desc: string;
  href: string;
};

export type PaletteResult = SearchNavigationCommand | ServiceResult | SearchResult;

export function isServiceResult(value: unknown): value is ServiceResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const item = value as Partial<ServiceResult>;
  return (
    item.type === 'service' &&
    item.label === 'SVC' &&
    typeof item.title === 'string' &&
    typeof item.desc === 'string' &&
    typeof item.href === 'string' &&
    Array.isArray(item.aliases) &&
    item.aliases.every((alias) => typeof alias === 'string') &&
    (item.privateRef === undefined || typeof item.privateRef === 'string') &&
    typeof item.pinned === 'boolean'
  );
}

export function toSearchResult(item: PagefindResultData): SearchResult {
  const fallbackTitle = item.url.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Untitled';
  return {
    type: 'search',
    label: 'DOC',
    title: item.meta.title || fallbackTitle,
    desc: stripMarkupToText(item.excerpt),
    href: item.url,
  };
}

export function matchSearchPalette(
  query: string,
  routes: readonly SearchNavigationCommand[],
  services: readonly ServiceResult[],
): PaletteResult[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [...routes, ...services.filter((service) => service.pinned).slice(0, 6)];
  const commands = routes.filter(
    (route) =>
      route.title.toLowerCase().includes(lowerQuery) ||
      route.alias?.some((alias) => alias.includes(lowerQuery)),
  );
  const matches = services.filter(
    (service) =>
      service.title.toLowerCase().includes(lowerQuery) ||
      service.aliases.some((alias) => alias.includes(lowerQuery)),
  );
  return [...commands, ...matches];
}
