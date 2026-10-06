import { initializeFacets } from './terminal-facets';
import {
  readBrowserSnapshot,
  withBrowserSnapshot,
  type BrowserSnapshot,
} from '../view-models/browser-snapshot';
import { applyFacets, objectPath } from '../view-models/terminal-filters';
import {
  filterTerminalObjects,
  parseTerminalCatalog,
  type TerminalLink,
} from '../view-models/terminal-object';

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function linkNode(link: TerminalLink, label = link.title): HTMLAnchorElement {
  const anchor = element('a', 'block py-1 hover:text-primary', label);
  anchor.href = link.href;
  if (/^https?:/.test(link.href)) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  return anchor;
}

function required<T extends Element>(root: Element, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`Missing object browser element: ${selector}`);
  return node;
}

export function initializeObjectBrowsers() {
  for (const root of document.querySelectorAll<HTMLElement>('[data-object-browser]')) {
    const list = required<HTMLElement>(root, '[data-object-list]');
    const preview = required<HTMLElement>(root, '[data-object-preview]');
    const previewHome = preview.parentElement;
    const detail = required<HTMLDialogElement>(root, '[data-object-detail]');
    detail.addEventListener('close', () => previewHome?.append(preview));
    const input = root.querySelector<HTMLInputElement>('[data-object-filter]');
    const more = required<HTMLButtonElement>(root, '[data-object-more]');
    const error = required<HTMLElement>(root, '[data-object-error]');
    const catalogUrl = root.dataset.catalog;
    let rows = Array.from(list.querySelectorAll<HTMLAnchorElement>('[data-object-row]'));
    const knownRows = new Map(rows.map((row) => [JSON.parse(row.dataset.object ?? '{}').id, row]));
    let items = parseTerminalCatalog(
      rows.map((row) => ({
        ...JSON.parse(row.dataset.object ?? '{}'),
        title: row.querySelector('[data-object-title]')?.textContent?.trim() ?? '',
        description: row.querySelector('.terminal-description')?.textContent ?? '',
      })),
    );
    let filtered = items;
    let selected = 0;
    let limit = items.length || 12;
    let loaded = !root.dataset.catalog;
    let pending: Promise<void> | undefined;
    const stateKey = root.dataset.contextPath ?? location.pathname;
    const initialState = readBrowserSnapshot(history.state, stateKey);
    let restoring = false;
    let restoreId: string | undefined;
    let generation = 0;

    const facets = initializeFacets(
      root,
      () => items,
      load,
      () => {
        generation++;
        limit = 24;
        syncQueryUrl();
        render();
      },
    );
    function updatePath(title?: string) {
      if (!root.getClientRects().length) return;
      const path = document.querySelector<HTMLElement>('[data-terminal-path]');
      if (path) {
        const base = root.dataset.contextPath ?? location.pathname;
        path.textContent =
          document.documentElement.dataset.ui === 'gui'
            ? base + (title ? ` · ${title}` : '')
            : objectPath(base, title);
        path.title = path.textContent;
      }
    }
    function saveState() {
      if (restoring) return;
      try {
        history.replaceState(
          withBrowserSnapshot(history.state, stateKey, {
            query: input?.value ?? '',
            facets: [...facets.selected()],
            selectedId: filtered[selected]?.id,
            limit,
          }),
          '',
        );
      } catch {
        /* Browser history limits must not disable browsing. */
      }
    }
    function syncQueryUrl() {
      if (!root.dataset.queryParam || !input) return;
      const url = new URL(location.href);
      input.value ? url.searchParams.set('q', input.value) : url.searchParams.delete('q');
      url.searchParams.delete('tag');
      for (const option of facets.options())
        if (option.group === '标签' && facets.selected().has(option.key))
          url.searchParams.append('tag', option.value);
      history.replaceState(history.state, '', url);
    }
    root.addEventListener('terminal-activate', () => select(selected, false, false));
    document.addEventListener('biome:ui-mode', () => select(selected, false, false));
    function select(index: number, scroll = false, remember = true) {
      selected = Math.max(0, Math.min(index, rows.length - 1));
      rows.forEach((row, i) => {
        row.setAttribute('aria-current', String(i === selected));
      });
      const item = filtered[selected];
      const source = rows[selected];
      if (remember) saveState();
      if (!item || !source) {
        preview.replaceChildren();
        updatePath();
        return;
      }
      updatePath(item.title);
      const open = source.cloneNode(false) as HTMLAnchorElement;
      open.removeAttribute('data-object');
      open.removeAttribute('data-object-row');
      open.removeAttribute('aria-current');
      open.className = 'mt-5 inline-block text-primary hover:underline';
      open.dataset.objectOpen = '';
      open.textContent =
        item.privateRef && source.getAttribute('href')?.startsWith('/login')
          ? 'Access →'
          : '打开 ↗';
      preview.replaceChildren(
        element('h2', 'text-lg font-semibold text-primary', item.title),
        element(
          'p',
          'object-detail-meta mt-3 text-xs text-muted-foreground',
          `${item.kind} · ${item.meta}`,
        ),
        element('p', 'object-detail-description mt-3 break-words', item.description),
        element(
          'p',
          'object-detail-tags mt-3 text-xs text-muted-foreground',
          item.tags.map((tag) => tag.split('/').pop()).join(' · '),
        ),
        open,
      );
      if (item.relations.length) {
        const related = element('div', 'mt-5 border-t border-border pt-3');
        related.append(element('h3', 'mb-2 text-xs text-muted-foreground', '关联'));
        item.relations.forEach((link, i) => {
          const anchor = linkNode(link, `[${i + 1}] ${link.title}`);
          anchor.dataset.objectRelation = '';
          related.append(anchor);
        });
        preview.append(related);
      }
      if (scroll) {
        if (list.contains(document.activeElement)) source.focus({ preventScroll: true });
        source.scrollIntoView({ block: 'nearest' });
      }
    }

    function render() {
      const selectedId = restoreId ?? filtered[selected]?.id;
      restoreId = undefined;
      filtered = applyFacets(
        filterTerminalObjects(items, input?.value ?? ''),
        facets.options(),
        facets.selected(),
      );
      rows = filtered.slice(0, limit).map((item) => {
        const existing = knownRows.get(item.id);
        if (existing) return existing;
        const row = linkNode(item);
        row.className = 'terminal-row';
        row.dataset.objectRow = '';
        if (item.privateRef) row.dataset.privateLink = item.privateRef;
        row.dataset.object = JSON.stringify(item);
        const title = element('strong', '', item.title);
        title.dataset.objectTitle = '';
        const symbol = element('span', 'text-muted-foreground', item.kind === 'note' ? '§' : ':');
        symbol.dataset.objectSymbol = '';
        const direct = element(
          'span',
          '',
          item.privateRef ? 'Access' : /^https?:/.test(item.href) ? '打开 ↗' : '查看 →',
        );
        direct.dataset.objectDirect = '';
        direct.dataset.uiOnly = 'gui';
        row.replaceChildren(
          element('span', 'terminal-pointer', '>'),
          symbol,
          title,
          element('span', 'terminal-description', item.description),
          element('span', 'terminal-meta', item.meta),
          direct,
        );
        knownRows.set(item.id, row);
        return row;
      });
      list.replaceChildren(...rows);
      const count = root.querySelector('[data-object-count]');
      if (count)
        count.textContent = `${rows.length} / ${loaded ? filtered.length : root.dataset.total}`;
      more.classList.toggle('hidden', loaded && rows.length >= filtered.length);
      root.querySelector('[data-object-empty]')?.classList.toggle('hidden', filtered.length !== 0);
      const next = filtered.findIndex((item) => item.id === selectedId);
      select(next >= 0 && next < rows.length ? next : 0);
      document.dispatchEvent(new Event('biome:objects-rendered'));
    }

    async function load() {
      if (loaded || !catalogUrl) return;
      if (pending) return pending;
      pending = (async () => {
        error.classList.add('hidden');
        more.disabled = true;
        try {
          const response = await fetch(catalogUrl, {
            cache: 'no-cache',
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) throw new Error('Catalog unavailable');
          items = parseTerminalCatalog(await response.json());
          loaded = true;
        } catch {
          error.classList.remove('hidden');
        } finally {
          more.disabled = false;
          pending = undefined;
        }
      })();
      return pending;
    }

    list.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLAnchorElement>('[data-object-row]');
      if (!target || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if ((event.target as Element).closest('[data-object-direct]')) return;
      // Native keyboard activation opens the link; pointer selection reveals its preview.
      if (event.detail === 0) return;
      event.preventDefault();
      select(rows.indexOf(target));
      if (
        document.documentElement.dataset.ui === 'gui' &&
        matchMedia('(max-width: 767px)').matches
      ) {
        detail.append(preview);
        detail.showModal();
      }
    });
    list.addEventListener('focusin', (event) => {
      const row = (event.target as Element).closest<HTMLAnchorElement>('[data-object-row]');
      if (row) select(rows.indexOf(row));
    });
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        generation++;
        input.value = '';
        syncQueryUrl();
        input.blur();
        void load().then(render);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        input.blur();
        select(selected + 1, true);
      }
    });
    input?.addEventListener('input', async () => {
      generation++;
      syncQueryUrl();
      await load();
      limit = 24;
      render();
    });
    more.addEventListener('click', async () => {
      await load();
      limit += 24;
      render();
    });
    root.querySelector('[data-object-retry]')?.addEventListener('click', async () => {
      await load();
      render();
    });
    root.addEventListener('terminal-select', (event) => {
      const delta = (event as CustomEvent<number>).detail;
      select(selected + delta, true);
    });
    // The existing private unlocker resolves the original static anchors. Refresh the
    // preview from that anchor after it changes rather than storing protected URLs.
    const observer = new MutationObserver(() => select(selected));
    observer.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'target'],
    });
    select(0, false, false);
    async function restore(snapshot: BrowserSnapshot) {
      const intent = ++generation;
      restoring = true;
      await load();
      if (intent !== generation) {
        restoring = false;
        return;
      }
      if (input) input.value = snapshot.query;
      facets.restore(snapshot.facets);
      limit = snapshot.limit;
      restoreId = snapshot.selectedId;
      restoring = false;
      render();
    }
    const params = new URLSearchParams(location.search);
    const tags = root.dataset.queryParam ? params.getAll(root.dataset.queryParam) : [];
    const query = root.dataset.queryParam ? (params.get('q') ?? '') : '';
    if (initialState) void restore(initialState);
    else if (tags.length || query)
      void restore({ query, facets: tags.map((tag) => JSON.stringify(['标签', tag])), limit: 24 });
    window.addEventListener('popstate', () => {
      const snapshot = readBrowserSnapshot(history.state, stateKey);
      if (snapshot) void restore(snapshot);
    });
  }
}
