import { initializeFacets } from './terminal-facets';
import {
  readBrowserSnapshot,
  withBrowserSnapshot,
  type BrowserSnapshot,
} from '../view-models/browser-snapshot';
import { objectPath } from '../view-models/terminal-filters';
import { materializeTerminalRows, paintTerminalPreview, required } from './terminal-browser-dom';
import { createTerminalBrowserState, visibleTerminalItems } from './terminal-browser-state';
import { bindTerminalBrowserEvents } from './terminal-browser-events';
import { createTerminalBrowserLoader, TERMINAL_PAGE_SIZE } from './terminal-browser-loader';
import { initialTerminalSnapshot, updatedTerminalUrl } from './terminal-url';

const DEFAULT_TOOLS_PANEL_ID = 'services';

export function mountTerminalBrowser(root: HTMLElement): () => void {
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const list = required<HTMLElement>(root, '[data-object-list]');
  const scroller = required<HTMLElement>(root, '[data-object-scroll]');
  const preview = required<HTMLElement>(root, '[data-object-preview]');
  const previewHome = preview.parentElement;
  const detail = required<HTMLDialogElement>(root, '[data-object-detail]');
  detail.addEventListener('close', () => previewHome?.append(preview), { signal });
  const input = root.querySelector<HTMLInputElement>('[data-object-filter]');
  const sort = root.querySelector<HTMLSelectElement>('[data-object-sort]');
  const status = required<HTMLElement>(root, '[data-object-status]');
  const more = required<HTMLButtonElement>(root, '[data-object-more]');
  const error = required<HTMLElement>(root, '[data-object-error]');
  const catalogUrl = root.dataset.catalog;
  const browser = createTerminalBrowserState(
    Array.from(list.querySelectorAll<HTMLAnchorElement>('[data-object-row]')),
    catalogUrl,
  );
  const stateKey = root.dataset.contextPath ?? location.pathname;
  const visible = () => {
    const panel = root.closest<HTMLElement>('[data-tools-panel]');
    const requested = document.getElementById(location.hash.slice(1));
    const active = requested?.hasAttribute('data-tools-panel')
      ? requested.id
      : DEFAULT_TOOLS_PANEL_ID;
    return !signal.aborted && root.getClientRects().length > 0 && (!panel || panel.id === active);
  };
  const sortValue = (): NonNullable<BrowserSnapshot['sort']> =>
    sort?.value === 'title' ? 'title' : 'default';

  const { load, showMore, refresh, hasMore, scheduleFill } = createTerminalBrowserLoader({
    root,
    list,
    scroller,
    more,
    error,
    status,
    catalogUrl,
    browser,
    signal,
    visible,
    render,
    select,
    syncQueryUrl,
    saveState,
  });
  browser.retry = () => refresh();

  const facets = initializeFacets(
    root,
    () => browser.items,
    load,
    () => {
      browser.generation++;
      browser.boundaryAt = 0;
      browser.limit = Math.max(browser.limit, TERMINAL_PAGE_SIZE);
      scroller.scrollTop = 0;
      syncQueryUrl();
      render();
    },
    signal,
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
    if (browser.restoring || !visible()) return;
    try {
      history.replaceState(
        withBrowserSnapshot(history.state, stateKey, {
          query: input?.value ?? '',
          facets: [...facets.selected()],
          selectedId: browser.filtered[browser.selected]?.id,
          limit: browser.limit,
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
    history.replaceState(
      history.state,
      '',
      updatedTerminalUrl(
        location.href,
        root.dataset.queryParam,
        input.value,
        sortValue(),
        facets.selected(),
        facets.options(),
      ),
    );
  }
  function scrollAnchor(): BrowserSnapshot['anchor'] {
    if (getComputedStyle(scroller).overflowY !== 'auto') return;
    const top = scroller.getBoundingClientRect().top;
    const index = browser.rows.findIndex((row) => row.getBoundingClientRect().bottom > top);
    return index < 0
      ? undefined
      : {
          id: browser.filtered[index].id,
          offset: browser.rows[index].getBoundingClientRect().top - top,
        };
  }
  function restoreAnchor(anchor: BrowserSnapshot['anchor']) {
    if (!anchor || !visible() || getComputedStyle(scroller).overflowY !== 'auto') return;
    const row = browser.rows[browser.filtered.findIndex((item) => item.id === anchor.id)];
    if (row)
      scroller.scrollTop +=
        row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - anchor.offset;
  }
  scroller.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(browser.scrollFrame);
      browser.scrollFrame = requestAnimationFrame(saveState);
    },
    { signal },
  );
  root.addEventListener(
    'terminal-deactivate',
    () => {
      browser.generation++;
      browser.boundaryAt = 0;
    },
    { signal },
  );
  function activate() {
    browser.boundaryAt = 0;
    const snapshot = readBrowserSnapshot(history.state, stateKey);
    if (snapshot) void restore(snapshot);
    else {
      const state = initialTerminalSnapshot(location.href, root.dataset.queryParam, browser.limit);
      const values = root.dataset.queryParam
        ? new URLSearchParams(location.search).getAll(root.dataset.queryParam)
        : [];
      if (state.query || values.length || state.sort === 'title') void restore(state);
      else {
        select(browser.selected, false, false);
        syncQueryUrl();
        scheduleFill();
      }
    }
  }
  root.addEventListener('terminal-activate', activate, { signal });
  document.addEventListener(
    'biome:before-ui-mode',
    () => {
      browser.rememberedAnchor = scrollAnchor();
      saveState();
    },
    { signal },
  );
  document.addEventListener(
    'biome:ui-mode',
    () => {
      browser.boundaryAt = 0;
      select(browser.selected, false, false);
      cancelAnimationFrame(browser.modeFrame);
      browser.modeFrame = requestAnimationFrame(() => {
        if (signal.aborted) return;
        restoreAnchor(browser.rememberedAnchor);
        scheduleFill();
      });
    },
    { signal },
  );
  function select(index: number, scroll = false, remember = true) {
    browser.selected = Math.max(0, Math.min(index, browser.rows.length - 1));
    browser.rows.forEach((row, i) => {
      row.setAttribute('aria-current', String(i === browser.selected));
    });
    const item = browser.filtered[browser.selected];
    const source = browser.rows[browser.selected];
    if (!browser.pending && error.classList.contains('hidden')) {
      status.textContent =
        browser.selected === browser.rows.length - 1 && browser.rows.length > 0
          ? hasMore()
            ? '已到当前末尾 · 连按 J 加载更多'
            : '已到末尾'
          : browser.loaded && browser.rows.length >= browser.filtered.length
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
    paintTerminalPreview(preview, item, source);
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
    const selectedId = browser.restoreId ?? browser.filtered[browser.selected]?.id;
    browser.restoreId = undefined;
    browser.filtered = visibleTerminalItems(
      browser.items,
      input?.value ?? '',
      facets.options(),
      facets.selected(),
      sortValue(),
    );
    browser.rows = materializeTerminalRows(browser.filtered, browser.limit, browser.knownRows);
    list.replaceChildren(...browser.rows);
    const count = root.querySelector('[data-object-count]');
    if (count)
      count.textContent = `${browser.rows.length} / ${browser.loaded ? browser.filtered.length : root.dataset.total}`;
    more.classList.toggle(
      'hidden',
      browser.loaded && browser.rows.length >= browser.filtered.length,
    );
    more.textContent = browser.loaded ? '显示更多' : '加载更多';
    root
      .querySelector('[data-object-empty]')
      ?.classList.toggle('hidden', browser.filtered.length !== 0);
    const next = browser.filtered.findIndex((item) => item.id === selectedId);
    select(next >= 0 && next < browser.rows.length ? next : 0);
    if (selectedId && next < 0 && browser.rows.length)
      status.textContent = '原选择不在当前结果中 · 已选择第一项';
    document.dispatchEvent(new Event('biome:objects-rendered'));
  }

  bindTerminalBrowserEvents({
    root,
    list,
    input,
    sort,
    more,
    status,
    detail,
    preview,
    browser,
    signal,
    select,
    refresh,
    showMore,
    hasMore,
  });
  // The existing private unlocker resolves the original static anchors. Refresh the
  // preview from that anchor after it changes rather than storing protected URLs.
  const observer = new MutationObserver(() => {
    if (!signal.aborted) select(browser.selected);
  });
  observer.observe(list, {
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'target'],
  });
  select(0, false, false);
  async function restore(snapshot: BrowserSnapshot) {
    if (!visible()) return;
    const intent = ++browser.generation;
    browser.restoring = true;
    browser.retry = () => restore(snapshot);
    const needsCatalog =
      snapshot.limit > browser.rows.length ||
      snapshot.query ||
      snapshot.facets.length ||
      snapshot.sort === 'title';
    if (needsCatalog) await load();
    if (intent !== browser.generation) {
      browser.restoring = false;
      return;
    }
    if (needsCatalog && !browser.loaded) {
      browser.restoring = false;
      return;
    }
    if (input) input.value = snapshot.query;
    if (sort) sort.value = snapshot.sort ?? 'default';
    facets.restore(snapshot.facets);
    browser.limit = snapshot.limit;
    browser.restoreId = snapshot.selectedId;
    render();
    restoreAnchor(snapshot.anchor);
    browser.restoring = false;
    syncQueryUrl();
    saveState();
    scheduleFill();
  }
  if (visible()) activate();
  window.addEventListener(
    'popstate',
    () => {
      const snapshot = readBrowserSnapshot(history.state, stateKey);
      if (snapshot && visible()) void restore(snapshot);
    },
    { signal },
  );
  const resizeObserver = new ResizeObserver(scheduleFill);
  resizeObserver.observe(scroller);
  void document.fonts.ready.then(() => {
    if (!signal.aborted) scheduleFill();
  });
  scheduleFill();
  return () => {
    if (signal.aborted) return;
    browser.generation++;
    lifecycle.abort();
    cancelAnimationFrame(browser.scrollFrame);
    cancelAnimationFrame(browser.fillFrame);
    cancelAnimationFrame(browser.modeFrame);
    observer.disconnect();
    resizeObserver.disconnect();
    facets.dispose();
    if (detail.open) detail.close();
    previewHome?.append(preview);
  };
}
