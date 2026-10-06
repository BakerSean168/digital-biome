export type UiMode = 'tui' | 'gui';
export const UI_MODE_STORAGE_KEY = 'digital-biome.ui-mode';

export function parseUiMode(value: unknown): UiMode | undefined {
  return value === 'tui' || value === 'gui' ? value : undefined;
}

export function resolveUiMode(url: URL, preference: unknown): UiMode {
  return parseUiMode(url.searchParams.get('ui')) ?? parseUiMode(preference) ?? 'tui';
}

/** Manual choice replaces a temporary override, retaining all content state. */
export function urlAfterModeChoice(url: URL, mode: UiMode, persisted: boolean): URL {
  const next = new URL(url);
  if (persisted) next.searchParams.delete('ui');
  else next.searchParams.set('ui', mode);
  return next;
}

/** A temporary share-link mode travels only with same-origin content links. */
export function withUiMode(href: string, current: URL): string {
  const mode = parseUiMode(current.searchParams.get('ui'));
  if (!mode) return href;
  const target = new URL(href, current);
  if (
    target.origin !== current.origin ||
    !['http:', 'https:'].includes(target.protocol) ||
    /^\/(api|cdn-cgi|data)(\/|$)/.test(target.pathname)
  )
    return href;
  target.searchParams.set('ui', mode);
  return target.pathname + target.search + target.hash;
}
