import { initializeFacets } from './terminal-facets';
import { compareResourceTitle } from '../domain/resource-order';
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
    const scroller = required<HTMLElement>(root, '[data-object-scroll]');
    const preview = required<HTMLElement>(root, '[data-object-preview]');
    const previewHome = preview.parentElement;
    const detail = required<HTMLDialogElement>(root, '[data-object-detail]');
    detail.addEventListener('close', () => previewHome?.append(preview));
    const input = root.querySelector<HTMLInputElement>('[data-object-filter]');
    const sort = root.querySelector<HTMLSelectElement>('[data-object-sort]');
    const status = required<HTMLElement>(root, '[data-object-status]');
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
    let restoring = false;
    let restoreId: string | undefined;
    let generation = 0;
    let boundaryAt = 0;
    let morePending = false;
    let scrollFrame = 0;
    let fillFrame = 0;
    let fillFailed = false;
    let rememberedAnchor: BrowserSnapshot['anchor'];
    let retry = () => refresh();
    const visible = () => {
      const panel = root.closest<HTMLElement>('[data-tools-panel]');
      const requested = document.getElementById(location.hash.slice(1));
      const active = requested?.hasAttribute('data-tools-panel') ? requested.id : 'services';
      return root.getClientRects().length > 0 && (!panel || panel.id === active);
    };
    const sortValue = (): NonNullable<BrowserSnapshot['sort']> =>
      sort?.value === 'title' ? 'title' : 'default';

    const facets = initializeFacets(
      root,
      () => items,
      load,
      () => {
        generation++;
        boundaryAt = 0;
        limit = Math.max(limit, 24);
        scroller.scrollTop = 0;
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
      if (restoring || !visible()) return;
      try {
        history.replaceState(
          withBrowserSnapshot(history.state, stateKey, {
            query: input?.value ?? '',
            facets: [...facets.selected()],
            selectedId: filtered[selected]?.id,
            limit,
            sort: sortValue(),
            anchor: scrollAnchor(),
          }),
          '',
        );
      } catch {
        /* Browser history limits must not disable browsing. */
      }
    }
    function syncQueryUrl() {
      if (!root.dataset.queryParam || !input || !visible()) return;
      const url = new URL(location.href);
      input.value ? url.searchParams.set('q', input.value) : url.searchParams.delete('q');
      sortValue() === 'title'
        ? url.searchParams.set('sort', 'title')
        : url.searchParams.delete('sort');
      const param = root.dataset.queryParam;
      url.searchParams.delete(param);
      for (const option of facets.options())
        if (facets.selected().has(option.key) && (param !== 'tag' || option.group === '标签'))
          url.searchParams.append(param, param === 'tag' ? option.value : option.key);
      history.replaceState(history.state, '', url);
    }
    function scrollAnchor(): BrowserSnapshot['anchor'] {
      if (getComputedStyle(scroller).overflowY !== 'auto') return;
      const top = scroller.getBoundingClientRect().top;
      const index = rows.findIndex((row) => row.getBoundingClientRect().bottom > top);
      return index < 0
        ? undefined
        : { id: filtered[index].id, offset: rows[index].getBoundingClientRect().top - top };
    }
    function restoreAnchor(anchor: BrowserSnapshot['anchor']) {
      if (!anchor || !visible() || getComputedStyle(scroller).overflowY !== 'auto') return;
      const row = rows[filtered.findIndex((item) => item.id === anchor.id)];
      if (row)
        scroller.scrollTop +=
          row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - anchor.offset;
    }
    scroller.addEventListener('scroll', () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(saveState);
    });
    root.addEventListener('terminal-deactivate', () => {
      generation++;
      boundaryAt = 0;
    });
    function activate() {
      boundaryAt = 0;
      const snapshot = readBrowserSnapshot(history.state, stateKey);
      if (snapshot) void restore(snapshot);
      else {
        const params = new URLSearchParams(location.search);
        const values = root.dataset.queryParam ? params.getAll(root.dataset.queryParam) : [];
        const state: BrowserSnapshot = {
          query: root.dataset.queryParam ? (params.get('q') ?? '') : '',
          facets:
            root.dataset.queryParam === 'tag'
              ? values.map((tag) => JSON.stringify(['标签', tag]))
              : values,
          limit,
          sort: params.get('sort') === 'title' ? 'title' : 'default',
        };
        if (state.query || values.length || state.sort === 'title') void restore(state);
        else {
          select(selected, false, false);
          syncQueryUrl();
          scheduleFill();
        }
      }
    }
    root.addEventListener('terminal-activate', activate);
    document.addEventListener('biome:before-ui-mode', () => {
      rememberedAnchor = scrollAnchor();
      saveState();
    });
    document.addEventListener('biome:ui-mode', () => {
      boundaryAt = 0;
      select(selected, false, false);
      requestAnimationFrame(() => {
        restoreAnchor(rememberedAnchor);
        scheduleFill();
      });
    });
    function select(index: number, scroll = false, remember = true) {
      selected = Math.max(0, Math.min(index, rows.length - 1));
      rows.forEach((row, i) => {
        row.setAttribute('aria-current', String(i === selected));
      });
      const item = filtered[selected];
      const source = rows[selected];
      if (!pending && error.classList.contains('hidden')) {
        status.textContent =
          selected === rows.length - 1 && rows.length > 0
            ? hasMore()
              ? '已到当前末尾 · 连按 J 加载更多'
              : '已到末尾'
            : loaded && rows.length >= filtered.length
              ? '已显示全部'
              : '';
      }
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
      const tags = element(
        'p',
        'object-detail-tags mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground',
      );
      for (const tag of item.tags) {
        const token = element('span', '', tag.split('/').pop());
        token.title = tag;
        tags.append(token);
      }
      preview.replaceChildren(
        element('h2', 'text-lg font-semibold text-primary', item.title),
        element(
          'p',
          'object-detail-meta mt-3 text-xs text-muted-foreground',
          `${item.kind} · ${item.meta}`,
        ),
        element('p', 'object-detail-description mt-3 break-words', item.description),
        tags,
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
        if (getComputedStyle(scroller).overflowY === 'auto') {
          const box = scroller.getBoundingClientRect();
          const row = source.getBoundingClientRect();
          if (row.top < box.top) scroller.scrollTop += row.top - box.top;
          else if (row.bottom > box.bottom) scroller.scrollTop += row.bottom - box.bottom;
        } else source.scrollIntoView({ block: 'nearest' });
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
      if (sortValue() === 'title') filtered.sort(compareResourceTitle);
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
      more.textContent = loaded ? '显示更多' : '加载更多';
      root.querySelector('[data-object-empty]')?.classList.toggle('hidden', filtered.length !== 0);
      const next = filtered.findIndex((item) => item.id === selectedId);
      select(next >= 0 && next < rows.length ? next : 0);
      if (selectedId && next < 0 && rows.length)
        status.textContent = '原选择不在当前结果中 · 已选择第一项';
      document.dispatchEvent(new Event('biome:objects-rendered'));
    }

    function hasMore() {
      return !loaded || rows.length < filtered.length;
    }
    async function showMore() {
      if (morePending || !hasMore()) return;
      morePending = true;
      boundaryAt = 0;
      const intent = ++generation;
      const previousCount = rows.length;
      retry = showMore;
      await load();
      morePending = false;
      if (!loaded || intent !== generation || !visible()) return;
      limit += 24;
      render();
      if (rows.length > previousCount) {
        rows[previousCount]?.focus({ preventScroll: true });
        select(previousCount, true);
      }
      status.textContent = `已显示 ${rows.length} / ${filtered.length}${hasMore() ? '' : ' · 已到末尾'}`;
    }

    async function refresh() {
      const intent = ++generation;
      restoring = false;
      boundaryAt = 0;
      retry = refresh;
      syncQueryUrl();
      saveState();
      await load();
      if (!loaded || intent !== generation || !visible()) return;
      limit = Math.max(limit, 24);
      scroller.scrollTop = 0;
      render();
      scheduleFill();
    }

    async function load() {
      if (loaded || !catalogUrl) return;
      if (pending) return pending;
      pending = (async () => {
        error.classList.add('hidden');
        more.disabled = true;
        more.textContent = '正在加载…';
        status.textContent = '正在加载…';
        list.setAttribute('aria-busy', 'true');
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
          status.textContent = '加载失败 · 可重试';
        } finally {
          more.disabled = false;
          more.textContent = loaded ? '显示更多' : '加载更多';
          list.removeAttribute('aria-busy');
          pending = undefined;
          // A restored view can still reflect SSR rows when this shared request finishes.
          // Refresh its current state; only the active caller may append or change selection.
          if (loaded && visible()) render();
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
        (root.closest('[data-browser-workspace]') ||
          document.documentElement.dataset.ui === 'gui') &&
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
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        input.value = '';
        input.blur();
        void refresh();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        input.blur();
        select(selected + 1, true);
      }
    });
    input?.addEventListener('input', () => {
      void refresh();
    });
    sort?.addEventListener('change', () => {
      void refresh();
    });
    more.addEventListener('click', () => {
      void showMore();
    });
    root.querySelector('[data-object-retry]')?.addEventListener('click', () => {
      fillFailed = false;
      void retry();
    });
    root.addEventListener('terminal-select', (event) => {
      const { delta, key, repeat } = (
        event as CustomEvent<{ delta: number; key: string; repeat: boolean }>
      ).detail;
      if (pending || morePending) return;
      if (delta > 0 && selected === rows.length - 1) {
        if (!hasMore()) {
          status.textContent = '已到末尾';
          return;
        }
        status.textContent = '已到当前末尾 · 连按 J 加载更多';
        if (key === 'j' && !repeat) {
          const now = performance.now();
          if (boundaryAt && now - boundaryAt <= 400) {
            void showMore();
            return;
          }
          boundaryAt = now;
        } else boundaryAt = 0;
        return;
      }
      boundaryAt = 0;
      select(selected + delta, true);
    });
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'j' || event.repeat) boundaryAt = 0;
      },
      true,
    );
    document.addEventListener('focusin', () => {
      boundaryAt = 0;
    });
    window.addEventListener('blur', () => {
      boundaryAt = 0;
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
      if (!visible()) return;
      const intent = ++generation;
      restoring = true;
      retry = () => restore(snapshot);
      const needsCatalog =
        snapshot.limit > rows.length ||
        snapshot.query ||
        snapshot.facets.length ||
        snapshot.sort === 'title';
      if (needsCatalog) await load();
      if (intent !== generation) {
        restoring = false;
        return;
      }
      if (needsCatalog && !loaded) {
        restoring = false;
        return;
      }
      if (input) input.value = snapshot.query;
      if (sort) sort.value = snapshot.sort ?? 'default';
      facets.restore(snapshot.facets);
      limit = snapshot.limit;
      restoreId = snapshot.selectedId;
      render();
      restoreAnchor(snapshot.anchor);
      restoring = false;
      syncQueryUrl();
      saveState();
      scheduleFill();
    }
    if (visible()) activate();
    window.addEventListener('popstate', () => {
      const snapshot = readBrowserSnapshot(history.state, stateKey);
      if (snapshot && visible()) void restore(snapshot);
    });
    function scheduleFill() {
      cancelAnimationFrame(fillFrame);
      fillFrame = requestAnimationFrame(() => {
        void fillViewport();
      });
    }
    async function fillViewport() {
      if (
        !root.hasAttribute('data-auto-fill') ||
        !visible() ||
        !matchMedia('(min-width: 768px)').matches ||
        pending ||
        restoring ||
        fillFailed
      )
        return;
      const height = rows[0]?.getBoundingClientRect().height;
      if (!height) return;
      const target = Math.min(80, Math.ceil(scroller.clientHeight / height) + 2);
      if (target <= limit || (loaded && rows.length >= filtered.length)) return;
      const intent = generation;
      retry = fillViewport;
      await load();
      if (!loaded) {
        fillFailed = true;
        return;
      }
      if (intent !== generation || !root.getClientRects().length) return;
      limit = Math.max(limit, target);
      render();
    }
    new ResizeObserver(scheduleFill).observe(scroller);
    void document.fonts.ready.then(scheduleFill);
    scheduleFill();
  }
  document.documentElement.dataset.browserReady = 'true';
}
