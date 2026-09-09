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

export async function hydratePagefindResults(
  results: readonly PagefindSearchResult[],
): Promise<PagefindResultData[]> {
  const hydrated = await Promise.all(results.map(result => result.data()));
  return hydrated.flatMap(value => {
    const normalized = normalizePagefindResult(value);
    return normalized ? [normalized] : [];
  });
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
