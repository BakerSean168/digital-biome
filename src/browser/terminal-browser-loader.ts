import { parseTerminalCatalog } from '../view-models/terminal-object';
import type { TerminalBrowserState } from './terminal-browser-state';

export const TERMINAL_PAGE_SIZE = 24;
const MAX_VIEWPORT_ROWS = 80;

export function createTerminalBrowserLoader({
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
}: {
  root: HTMLElement;
  list: HTMLElement;
  scroller: HTMLElement;
  more: HTMLButtonElement;
  error: HTMLElement;
  status: HTMLElement;
  catalogUrl: string | undefined;
  browser: TerminalBrowserState;
  signal: AbortSignal;
  visible: () => boolean;
  render: () => void;
  select: (index: number, scroll?: boolean, remember?: boolean) => void;
  syncQueryUrl: () => void;
  saveState: () => void;
}) {
  function hasMore() {
    return !browser.loaded || browser.rows.length < browser.filtered.length;
  }
  async function showMore() {
    if (browser.morePending || !hasMore()) return;
    browser.morePending = true;
    browser.boundaryAt = 0;
    const intent = ++browser.generation;
    const previousCount = browser.rows.length;
    browser.retry = showMore;
    await load();
    browser.morePending = false;
    if (!browser.loaded || intent !== browser.generation || !visible()) return;
    browser.limit += TERMINAL_PAGE_SIZE;
    render();
    if (browser.rows.length > previousCount) {
      browser.rows[previousCount]?.focus({ preventScroll: true });
      select(previousCount, true);
    }
    status.textContent = `已显示 ${browser.rows.length} / ${browser.filtered.length}${hasMore() ? '' : ' · 已到末尾'}`;
  }

  async function refresh() {
    if (signal.aborted) return;
    const intent = ++browser.generation;
    browser.restoring = false;
    browser.boundaryAt = 0;
    browser.retry = refresh;
    syncQueryUrl();
    saveState();
    await load();
    if (!browser.loaded || intent !== browser.generation || !visible()) return;
    browser.limit = Math.max(browser.limit, TERMINAL_PAGE_SIZE);
    scroller.scrollTop = 0;
    render();
    scheduleFill();
  }

  async function load() {
    if (signal.aborted || browser.loaded || !catalogUrl) return;
    if (browser.pending) return browser.pending;
    browser.pending = (async () => {
      error.classList.add('hidden');
      more.disabled = true;
      more.textContent = '正在加载…';
      status.textContent = '正在加载…';
      list.setAttribute('aria-busy', 'true');
      try {
        const response = await fetch(catalogUrl, {
          cache: 'no-cache',
          headers: { Accept: 'application/json' },
          signal,
        });
        if (signal.aborted) return;
        if (!response.ok) throw new Error('Catalog unavailable');
        const payload: unknown = await response.json();
        if (signal.aborted) return;
        browser.items = parseTerminalCatalog(payload);
        browser.loaded = true;
      } catch {
        if (!signal.aborted) {
          error.classList.remove('hidden');
          status.textContent = '加载失败 · 可重试';
        }
      } finally {
        browser.pending = undefined;
        if (!signal.aborted) {
          more.disabled = false;
          more.textContent = browser.loaded ? '显示更多' : '加载更多';
          list.removeAttribute('aria-busy');
          // A restored view can still reflect SSR rows when this shared request finishes.
          // Refresh its current state; only the active caller may append or change selection.
          if (browser.loaded && visible()) render();
        }
      }
    })();
    return browser.pending;
  }

  function scheduleFill() {
    if (signal.aborted) return;
    cancelAnimationFrame(browser.fillFrame);
    browser.fillFrame = requestAnimationFrame(() => {
      if (!signal.aborted) void fillViewport();
    });
  }
  async function fillViewport() {
    if (
      !root.hasAttribute('data-auto-fill') ||
      !visible() ||
      !matchMedia('(min-width: 768px)').matches ||
      browser.pending ||
      browser.restoring ||
      browser.fillFailed
    )
      return;
    const height = browser.rows[0]?.getBoundingClientRect().height;
    if (!height) return;
    const target = Math.min(MAX_VIEWPORT_ROWS, Math.ceil(scroller.clientHeight / height) + 2);
    if (
      target <= browser.limit ||
      (browser.loaded && browser.rows.length >= browser.filtered.length)
    )
      return;
    const intent = browser.generation;
    browser.retry = fillViewport;
    await load();
    if (!browser.loaded) {
      browser.fillFailed = true;
      return;
    }
    if (intent !== browser.generation || !root.getClientRects().length) return;
    browser.limit = Math.max(browser.limit, target);
    render();
  }
  return { load, showMore, refresh, hasMore, scheduleFill };
}
