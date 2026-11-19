import summariesData from '../data/indexes/uses-summaries.json';
import { parseUsesSummaries } from '../domain/uses-summary';
import { selectResourceEntries, toResourceObject } from '../domain/resource-collections';
import { getAllNoteEntries } from '../repositories/knowledge-index-loader';
import { getResourceCollection } from '../repositories/resource-collections-repository';
import type { TerminalObject } from './terminal-object';

export function usesHardwareObjects(): TerminalObject[] {
  const summaries = parseUsesSummaries(summariesData).map((item) => ({
    order: item.order,
    id: 'uses-summary-' + item.id,
    kind: 'hardware',
    title: item.title,
    description: item.description,
    href: '/uses#hardware',
    meta: item.group,
    tags: [],
    relations: [],
    facets: { 分类: [item.group] },
  }));
  const hardware = selectResourceEntries(getAllNoteEntries(), 'uses')
    .filter((entry) => entry.filePath.startsWith('uses/hardware/'))
    .map((entry) => ({ ...toResourceObject(entry), order: entry.order }));
  return [...summaries, ...hardware]
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    )
    .map(({ order: _order, ...item }) => item);
}

export function usesSoftwareObjects(): TerminalObject[] {
  return getResourceCollection('uses').filter((item) => item.kind === 'software');
}
