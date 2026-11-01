import { compareResourceTitle } from '../domain/resource-order';
import { applyFacets, type FacetOption } from '../view-models/terminal-filters';
import {
  filterTerminalObjects,
  parseTerminalCatalog,
  type TerminalObject,
} from '../view-models/terminal-object';
import type { BrowserSnapshot } from '../view-models/browser-snapshot';

export interface TerminalBrowserState {
  rows: HTMLAnchorElement[];
  knownRows: Map<string, HTMLAnchorElement>;
  items: TerminalObject[];
  filtered: TerminalObject[];
  selected: number;
  limit: number;
  loaded: boolean;
  pending?: Promise<void>;
  restoring: boolean;
  restoreId?: string;
  generation: number;
  boundaryAt: number;
  morePending: boolean;
  scrollFrame: number;
  fillFrame: number;
  modeFrame: number;
  fillFailed: boolean;
  rememberedAnchor?: BrowserSnapshot['anchor'];
  retry: () => void | Promise<void>;
}

/** One independent mutable owner per ObjectBrowser instance. Never share across roots. */
export function createTerminalBrowserState(
  initialRows: HTMLAnchorElement[],
  catalogUrl: string | undefined,
): TerminalBrowserState {
  const items = parseTerminalCatalog(
    initialRows.map((row) => ({
      ...JSON.parse(row.dataset.object ?? '{}'),
      title: row.querySelector('[data-object-title]')?.textContent?.trim() ?? '',
      description: row.querySelector('.terminal-description')?.textContent ?? '',
    })),
  );
  return {
    rows: initialRows,
    knownRows: new Map(initialRows.map((row) => [JSON.parse(row.dataset.object ?? '{}').id, row])),
    items,
    filtered: items,
    selected: 0,
    limit: items.length || 12,
    loaded: !catalogUrl,
    restoring: false,
    generation: 0,
    boundaryAt: 0,
    morePending: false,
    scrollFrame: 0,
    fillFrame: 0,
    modeFrame: 0,
    fillFailed: false,
    retry: () => {},
  };
}

export function visibleTerminalItems(
  items: TerminalObject[],
  query: string,
  options: FacetOption[],
  selected: Set<string>,
  sort: 'default' | 'title',
): TerminalObject[] {
  const matching = applyFacets(filterTerminalObjects(items, query), options, selected);
  if (sort === 'title') matching.sort(compareResourceTitle);
  return matching;
}
