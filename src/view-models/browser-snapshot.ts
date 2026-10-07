/** Browser-entry state contains only public IDs and user-entered filters, never targets. */
export interface BrowserSnapshot {
  query: string;
  facets: string[];
  selectedId?: string;
  limit: number;
  sort?: 'default' | 'title';
  anchor?: { id: string; offset: number };
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
    (v.selectedId !== undefined &&
      (typeof v.selectedId !== 'string' || v.selectedId.length > 2000)) ||
    (v.sort !== undefined && v.sort !== 'default' && v.sort !== 'title') ||
    (v.anchor !== undefined &&
      (!v.anchor ||
        typeof v.anchor !== 'object' ||
        typeof v.anchor.id !== 'string' ||
        v.anchor.id.length > 2000 ||
        typeof v.anchor.offset !== 'number' ||
        !Number.isFinite(v.anchor.offset) ||
        Math.abs(v.anchor.offset) > 10000))
  )
    return;
  return {
    query: v.query,
    facets: [...v.facets],
    limit: v.limit,
    ...(v.selectedId !== undefined ? { selectedId: v.selectedId } : {}),
    ...(v.sort !== undefined ? { sort: v.sort } : {}),
    ...(v.anchor !== undefined ? { anchor: { id: v.anchor.id, offset: v.anchor.offset } } : {}),
  };
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
