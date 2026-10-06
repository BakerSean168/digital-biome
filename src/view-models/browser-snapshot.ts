/** Browser-entry state contains only public IDs and user-entered filters, never targets. */
export interface BrowserSnapshot {
  query: string;
  facets: string[];
  selectedId?: string;
  limit: number;
}

export function readBrowserSnapshot(state: unknown, key: string): BrowserSnapshot | undefined {
  if (!state || typeof state !== 'object' || !('biomeBrowsers' in state)) return;
  const all = state.biomeBrowsers;
  if (!all || typeof all !== 'object' || !(key in all)) return;
  const value: unknown = Reflect.get(all, key);
  if (!value || typeof value !== 'object') return;
  const v = value as Partial<BrowserSnapshot>;
  if (
    typeof v.query !== 'string' ||
    v.query.length > 4000 ||
    !Array.isArray(v.facets) ||
    v.facets.length > 1000 ||
    !v.facets.every((item) => typeof item === 'string' && item.length <= 2000) ||
    typeof v.limit !== 'number' ||
    !Number.isInteger(v.limit) ||
    v.limit < 1 ||
    v.limit > 10000 ||
    (v.selectedId !== undefined && (typeof v.selectedId !== 'string' || v.selectedId.length > 2000))
  )
    return;
  return { query: v.query, facets: [...v.facets], selectedId: v.selectedId, limit: v.limit };
}

export function withBrowserSnapshot(
  state: unknown,
  key: string,
  snapshot: BrowserSnapshot,
): Record<string, unknown> {
  const base = state && typeof state === 'object' ? state : {};
  const existing =
    'biomeBrowsers' in base && base.biomeBrowsers && typeof base.biomeBrowsers === 'object'
      ? base.biomeBrowsers
      : {};
  return { ...base, biomeBrowsers: { ...existing, [key]: snapshot } };
}
