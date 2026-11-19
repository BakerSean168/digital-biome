import type { NoteIndexEntry } from '../types/knowledge-index';
import { isSafeTerminalHref, type TerminalObject } from '../view-models/terminal-object';
import { buildAssetHref, buildKnowledgeNoteHref } from './note-routing/url-builder';

export type ResourceView = 'uses' | 'bookmarks' | 'blogroll' | 'carry' | 'defaults';
type ResourceKind = 'hardware' | 'software' | 'services' | 'websites';

function resourceKind(entry: NoteIndexEntry): ResourceKind | undefined {
  const match = /^uses\/(hardware|software|services|websites)\/[^/]+\.md$/.exec(entry.filePath);
  return (match?.[1] ?? (entry.bookmarked === true ? 'websites' : undefined)) as
    | ResourceKind
    | undefined;
}

function publicResource(entry: NoteIndexEntry): boolean {
  return (
    resourceKind(entry) !== undefined &&
    entry.visibility === 'public' &&
    !entry.draft &&
    !entry.private
  );
}

function containsTag(entry: NoteIndexEntry, tag: string) {
  return entry.tags.some((candidate) => candidate.toLowerCase() === tag);
}

export function selectResourceEntries(
  entries: readonly NoteIndexEntry[],
  view: ResourceView,
): NoteIndexEntry[] {
  return entries
    .filter((entry) => {
      if (!publicResource(entry)) return false;
      const kind = resourceKind(entry);
      if (view === 'uses')
        return (
          entry.filePath.startsWith('uses/') &&
          entry.status === 'active' &&
          entry.showOnUses !== false
        );
      if (view === 'bookmarks') return entry.bookmarked === true;
      if (view === 'blogroll')
        return (
          entry.filePath.startsWith('uses/websites/') &&
          kind === 'websites' &&
          entry.bookmarked === true &&
          containsTag(entry, 'blogroll')
        );
      if (view === 'carry')
        return kind === 'hardware' && entry.status === 'active' && containsTag(entry, 'carry');
      if (view === 'defaults')
        return (
          entry.filePath.startsWith('uses/') &&
          entry.status === 'active' &&
          Boolean(entry.defaultFor?.length)
        );
      return false;
    })
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        a.title.localeCompare(b.title, 'zh-CN') ||
        a.id.localeCompare(b.id),
    );
}

/** Multiple choices for the same default use case require an explicit review. */
export function findDefaultConflicts(entries: readonly NoteIndexEntry[]): string[] {
  const seen = new Map<string, number>();
  for (const entry of selectResourceEntries(entries, 'defaults')) {
    for (const purpose of new Set(entry.defaultFor)) {
      seen.set(purpose, (seen.get(purpose) ?? 0) + 1);
    }
  }
  return [...seen]
    .filter(([, count]) => count > 1)
    .map(([purpose]) => purpose)
    .sort();
}

export function toResourceObject(entry: NoteIndexEntry): TerminalObject {
  const kind = resourceKind(entry);
  if (!kind || !publicResource(entry)) {
    throw new Error('Cannot present a non-public resource');
  }
  const href =
    kind === 'websites' && entry.url && isSafeTerminalHref(entry.url)
      ? entry.url
      : entry.asset_id && entry.asset_type
        ? buildAssetHref({ asset_id: entry.asset_id, asset_type: entry.asset_type })
        : buildKnowledgeNoteHref(entry.id);
  const group = entry.category || kind.toUpperCase();
  return {
    id: entry.asset_id ?? entry.id,
    kind: kind === 'websites' ? 'external' : kind,
    title: entry.title,
    description: entry.description ?? '',
    href,
    meta: entry.defaultFor?.join(' · ') || group.toLowerCase(),
    tags: entry.tags,
    relations: [],
    facets: { 分类: [group], ...(entry.defaultFor?.length ? { 用途: entry.defaultFor } : {}) },
  };
}

export function selectHomepageResources(entries: readonly NoteIndexEntry[]): NoteIndexEntry[] {
  return selectResourceEntries(entries, 'bookmarks')
    .filter((entry) => entry.homepageOrder !== undefined)
    .sort((a, b) => (a.homepageOrder ?? 0) - (b.homepageOrder ?? 0) || a.id.localeCompare(b.id));
}
