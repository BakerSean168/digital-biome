/** Singleton page content is owned by Thought Forest pages/*.md. */

import { parseAboutBody, parseNowBody } from '../domain/site-pages/content';
import { getContentEntriesByIds } from './content-entry-repository';
import { getNoteEntryByIdFromIndex } from './knowledge-index-loader';

export type AuthorPageName = 'colophon' | 'ai' | 'ideas' | 'canon';

async function pageEntry(name: 'about' | 'now' | AuthorPageName) {
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
  return { body: entry.body, title: entry.data.title, updatedAt, entry };
}

export async function getAboutPage() {
  const source = await pageEntry('about');
  if (!source) throw new Error('Required public page is missing');
  return {
    fromObsidian: true as const,
    title: source.title ?? 'BakerSean',
    updatedAt: source.updatedAt,
    sections: parseAboutBody(source.body),
  };
}

export async function getNowPage() {
  const source = await pageEntry('now');
  if (!source) throw new Error('Required public page is missing');
  return {
    fromObsidian: true as const,
    title: source.title ?? '最近在做什么',
    updatedAt: source.updatedAt,
    entries: parseNowBody(source.body),
  };
}

// No fake editorial fallback: a missing optional Markdown page has no author content.
export async function getAuthoredPage(name: AuthorPageName) {
  return pageEntry(name);
}
