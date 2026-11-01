import { loadOwnerSystems } from './owner-systems-data';
import { clearOwnerSystems, renderOwnerSystems } from './owner-systems-view';

interface OwnerSystemsMount {
  dispose: () => void;
}

const mounts = new WeakMap<Document, OwnerSystemsMount>();

/**
 * Client-only access controller. No identity, owner catalog or protected link
 * is injected into static SSR, browser storage, URL state, or public catalogs.
 */
export function initOwnerSystems(
  doc: Document = document,
  fetcher: typeof fetch = fetch,
  view: Window = window,
): () => void {
  const previous = mounts.get(doc);
  if (previous) return previous.dispose;
  const label = doc.querySelector<HTMLElement>('[data-systems-access-label]');
  const description = doc.querySelector<HTMLElement>('[data-systems-access-description]');
  const action = doc.querySelector<HTMLAnchorElement>('[data-systems-access-action]');
  const grid = doc.querySelector<HTMLElement>('[data-system-domain-grid]');
  const gate = grid?.querySelector<HTMLElement>('[data-owner-domain-gate]');
  if (!label || !description || !action || !grid || !gate) return () => {};

  const loginHref = action.getAttribute('href') ?? '/login?next=%2Fsystems';
  const lifetime = new AbortController();
  const { signal } = lifetime;

  const dispose = (): void => {
    if (signal.aborted) return;
    lifetime.abort();
    clearOwnerSystems(grid, gate);
    label.textContent = 'Public view';
    description.textContent = 'Owner targets stay locked';
    action.href = loginHref;
    action.textContent = 'Owner';
    mounts.delete(doc);
  };
  mounts.set(doc, { dispose });
  view.addEventListener('pagehide', dispose, { signal });

  void loadOwnerSystems(fetcher, signal).then(({ authenticated, catalog }) => {
    if (signal.aborted || !authenticated) return;
    label.textContent = 'Owner view';
    description.textContent = '私有入口已可直接打开';
    action.href = '/cdn-cgi/access/logout';
    action.textContent = 'Sign out';
    if (catalog) renderOwnerSystems(doc, grid, gate, catalog);
  });
  return dispose;
}
