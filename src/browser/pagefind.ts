export interface PagefindResultData {
  readonly url: string;
  readonly excerpt: string;
  readonly meta: Readonly<Record<string, string>>;
}

export interface PagefindSearchResult {
  readonly data: () => Promise<unknown>;
}

export interface PagefindSearchResponse {
  readonly results: readonly PagefindSearchResult[];
}

export interface PagefindRuntime {
  readonly init: () => Promise<void>;
  readonly search: (query: string) => Promise<PagefindSearchResponse>;
}

export type PagefindImporter = () => Promise<unknown>;

export interface PagefindAdapter {
  readonly load: () => Promise<PagefindRuntime | null>;
  readonly hydrate: (results: readonly PagefindSearchResult[]) => Promise<PagefindResultData[]>;
}

export type PagefindSearchStatus =
  | 'unavailable'
  | 'query-failed'
  | 'hydration-failed'
  | 'success'
  | 'partial'
  | 'zero-match';

export interface PagefindHydrationOutcome {
  readonly results: PagefindResultData[];
  readonly failedCount: number;
}

export interface PagefindSearchOutcome extends PagefindHydrationOutcome {
  readonly status: PagefindSearchStatus;
}

export type PagefindLoader = () => Promise<PagefindRuntime | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPagefindRuntime(value: unknown): value is PagefindRuntime {
  return isRecord(value) && typeof value.init === 'function' && typeof value.search === 'function';
}

function getPagefindRuntime(value: unknown): PagefindRuntime | null {
  if (isPagefindRuntime(value)) return value;
  if (isRecord(value) && isPagefindRuntime(value.default)) return value.default;
  return null;
}

function importPagefind(): Promise<unknown> {
  const importer = new Function('return import("/pagefind/pagefind.js")') as () => Promise<unknown>;
  return importer();
}

async function initializePagefind(importer: PagefindImporter): Promise<PagefindRuntime> {
  const runtime = getPagefindRuntime(await importer());
  if (!runtime) throw new TypeError('The Pagefind module has an unexpected shape.');
  await runtime.init();
  return runtime;
}

export function normalizePagefindResult(value: unknown): PagefindResultData | null {
  if (!isRecord(value) || typeof value.url !== 'string') return null;

  const meta: Record<string, string> = {};
  if (isRecord(value.meta)) {
    for (const [key, entry] of Object.entries(value.meta)) {
      if (typeof entry === 'string') meta[key] = entry;
    }
  }

  return {
    url: value.url,
    excerpt: typeof value.excerpt === 'string' ? value.excerpt : '',
    meta,
  };
}

export async function hydratePagefindResultsWithStatus(
  results: readonly PagefindSearchResult[],
): Promise<PagefindHydrationOutcome> {
  const settled = await Promise.allSettled(results.map(result => Promise.resolve().then(() => result.data())));
  const hydrated: PagefindResultData[] = [];
  let failedCount = 0;

  settled.forEach(result => {
    if (result.status === 'rejected') {
      failedCount += 1;
      return;
    }
    const normalized = normalizePagefindResult(result.value);
    if (normalized) hydrated.push(normalized);
    else failedCount += 1;
  });

  return { results: hydrated, failedCount };
}

export async function hydratePagefindResults(
  results: readonly PagefindSearchResult[],
): Promise<PagefindResultData[]> {
  return (await hydratePagefindResultsWithStatus(results)).results;
}

export async function searchPagefind(
  load: PagefindLoader,
  query: string,
  limit?: number,
): Promise<PagefindSearchOutcome> {
  let pagefind: PagefindRuntime | null;
  try {
    pagefind = await load();
  } catch (error) {
    console.warn('Full-text search is temporarily unavailable.', error);
    return { status: 'unavailable', results: [], failedCount: 0 };
  }

  if (!pagefind) return { status: 'unavailable', results: [], failedCount: 0 };

  try {
    const search = await pagefind.search(query);
    const results = limit === undefined ? search.results : search.results.slice(0, limit);
    const hydration = await hydratePagefindResultsWithStatus(results);
    let status: PagefindSearchStatus = 'success';
    if (hydration.failedCount > 0 && hydration.results.length === 0) status = 'hydration-failed';
    else if (hydration.failedCount > 0) status = 'partial';
    else if (hydration.results.length === 0) status = 'zero-match';
    return { ...hydration, status };
  } catch (error) {
    console.error('Full-text search query failed.', error);
    return { status: 'query-failed', results: [], failedCount: 0 };
  }
}

export function createPagefindAdapter(importer: PagefindImporter = importPagefind): PagefindAdapter {
  let loadPromise: Promise<PagefindRuntime | null> | undefined;

  const load = (): Promise<PagefindRuntime | null> => {
    loadPromise ??= initializePagefind(importer).catch(error => {
      console.warn('Pagefind is not available in this environment.', error);
      return null;
    });
    return loadPromise;
  };

  return { load, hydrate: hydratePagefindResults };
}

const pagefindAdapter = createPagefindAdapter();

export const loadPagefind = pagefindAdapter.load;
