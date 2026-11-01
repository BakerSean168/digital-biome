import type { BrowserSnapshot } from '../view-models/browser-snapshot';
import type { FacetOption } from '../view-models/terminal-filters';

export function initialTerminalSnapshot(
  locationHref: string,
  queryParam: string | undefined,
  limit: number,
): BrowserSnapshot {
  const params = new URL(locationHref).searchParams;
  const values = queryParam ? params.getAll(queryParam) : [];
  return {
    query: queryParam ? (params.get('q') ?? '') : '',
    facets: queryParam === 'tag' ? values.map((tag) => JSON.stringify(['标签', tag])) : values,
    limit,
    sort: params.get('sort') === 'title' ? 'title' : 'default',
  };
}

/** Preserve the current route, hash, ui mode and unrelated query parameters. */
export function updatedTerminalUrl(
  locationHref: string,
  queryParam: string,
  query: string,
  sort: 'default' | 'title',
  selected: ReadonlySet<string>,
  options: readonly FacetOption[],
): URL {
  const url = new URL(locationHref);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  if (sort === 'title') url.searchParams.set('sort', 'title');
  else url.searchParams.delete('sort');
  url.searchParams.delete(queryParam);
  for (const option of options) {
    if (selected.has(option.key) && (queryParam !== 'tag' || option.group === '标签')) {
      url.searchParams.append(queryParam, queryParam === 'tag' ? option.value : option.key);
    }
  }
  return url;
}
