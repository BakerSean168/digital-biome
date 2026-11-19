/**
 * Singleton page content is owned by Thought Forest pages/{about,now}.md.
 * Legacy TS snapshots are read-only roll-forward compatibility while the
 * producer is migrating; they are not an alternate editing surface.
 */

import { ABOUT_SECTIONS, ABOUT_UPDATED_AT } from '../config/about-profile';
import { NOW_ENTRIES, NOW_UPDATED_AT } from '../config/now-profile';
import { parseAboutBody, parseNowBody } from '../domain/site-pages/content';
import { getContentEntriesByIds } from './content-entry-repository';
import { getNoteEntryByIdFromIndex } from './knowledge-index-loader';

async function pageEntry(name: 'about' | 'now') {
  const id = `obsidian/pages/${name}`;
  const index = getNoteEntryByIdFromIndex(id);
  if (!index) return undefined;
  if (index.draft || index.private || index.visibility !== 'public') {
    throw new Error(`Public singleton page is not public: pages/${name}.md`);
  }
  const entries = await getContentEntriesByIds([id]);
  const entry = entries[0];
  if (!entry || !('body' in entry) || typeof entry.body !== 'string') {
    throw new Error(`Public singleton page is missing its Markdown body: pages/${name}.md`);
  }
  if (entry.data.draft || entry.data.private || entry.data.visibility !== 'public') {
    throw new Error(`Public singleton page failed Markdown visibility check: pages/${name}.md`);
  }
  const updatedAt = entry.data.updated ? entry.data.updated.toISOString().slice(0, 10) : undefined;
  if (!updatedAt) throw new Error(`Public singleton page missing updated date: pages/${name}.md`);
  return { body: entry.body, title: entry.data.title, updatedAt };
}

export async function getAboutPage() {
  const source = await pageEntry('about');
  if (!source)
    return {
      fromObsidian: false as const,
      title: 'BakerSean',
      updatedAt: ABOUT_UPDATED_AT,
      sections: ABOUT_SECTIONS,
    };
  return {
    fromObsidian: true as const,
    title: source.title ?? 'BakerSean',
    updatedAt: source.updatedAt,
    sections: parseAboutBody(source.body),
  };
}

export async function getNowPage() {
  const source = await pageEntry('now');
  if (!source)
    return {
      fromObsidian: false as const,
      title: '最近在做什么',
      updatedAt: NOW_UPDATED_AT,
      entries: NOW_ENTRIES,
    };
  return {
    fromObsidian: true as const,
    title: source.title ?? '最近在做什么',
    updatedAt: source.updatedAt,
    entries: parseNowBody(source.body),
  };
}
