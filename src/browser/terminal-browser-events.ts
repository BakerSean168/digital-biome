import type { TerminalBrowserState } from './terminal-browser-state';
import { isImeComposition } from './ime-composition';

export interface TerminalBrowserEventDependencies {
  root: HTMLElement;
  list: HTMLElement;
  input: HTMLInputElement | null;
  sort: HTMLSelectElement | null;
  more: HTMLButtonElement;
  status: HTMLElement;
  detail: HTMLDialogElement;
  preview: HTMLElement;
  browser: TerminalBrowserState;
  signal: AbortSignal;
  select: (index: number, scroll?: boolean) => void;
  refresh: () => Promise<void>;
  showMore: () => Promise<void>;
  hasMore: () => boolean;
  doc?: Document;
  view?: Window;
}

/** Browser-local input, pointer and keyboard events. All listeners share one owner signal. */
export function bindTerminalBrowserEvents(deps: TerminalBrowserEventDependencies): void {
  const {
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
    doc = document,
    view = window,
  } = deps;
  list.addEventListener(
    'click',
    (event) => {
      const target = (event.target as Element).closest<HTMLAnchorElement>('[data-object-row]');
      if (!target || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if ((event.target as Element).closest('[data-object-direct]')) return;
      // Native keyboard activation opens the link; pointer selection reveals its preview.
      if (event.detail === 0) return;
      event.preventDefault();
      select(browser.rows.indexOf(target));
      if (
        (root.closest('[data-browser-workspace]') || doc.documentElement.dataset.ui === 'gui') &&
        matchMedia('(max-width: 767px)').matches
      ) {
        detail.append(preview);
        detail.showModal();
      }
    },
    { signal },
  );
  list.addEventListener(
    'focusin',
    (event) => {
      const row = (event.target as Element).closest<HTMLAnchorElement>('[data-object-row]');
      if (row) select(browser.rows.indexOf(row));
    },
    { signal },
  );
  input?.addEventListener(
    'keydown',
    (event) => {
      if (isImeComposition(event)) return;
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
        select(browser.selected + 1, true);
      }
    },
    { signal },
  );
  input?.addEventListener(
    'input',
    () => {
      void refresh();
    },
    { signal },
  );
  sort?.addEventListener(
    'change',
    () => {
      void refresh();
    },
    { signal },
  );
  more.addEventListener(
    'click',
    () => {
      void showMore();
    },
    { signal },
  );
  root.querySelector('[data-object-retry]')?.addEventListener(
    'click',
    () => {
      browser.fillFailed = false;
      void browser.retry();
    },
    { signal },
  );
  root.addEventListener(
    'terminal-select',
    (event) => {
      const { delta, key, repeat } = (
        event as CustomEvent<{ delta: number; key: string; repeat: boolean }>
      ).detail;
      if (browser.pending || browser.morePending) return;
      if (delta > 0 && browser.selected === browser.rows.length - 1) {
        if (!hasMore()) {
          status.textContent = '已到末尾';
          return;
        }
        status.textContent = '已到当前末尾 · 连按 J 加载更多';
        if (key === 'j' && !repeat) {
          const now = performance.now();
          if (browser.boundaryAt && now - browser.boundaryAt <= 400) {
            void showMore();
            return;
          }
          browser.boundaryAt = now;
        } else browser.boundaryAt = 0;
        return;
      }
      browser.boundaryAt = 0;
      select(browser.selected + delta, true);
    },
    { signal },
  );
  doc.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'j' || event.repeat) browser.boundaryAt = 0;
    },
    { capture: true, signal },
  );
  doc.addEventListener(
    'focusin',
    () => {
      browser.boundaryAt = 0;
    },
    { signal },
  );
  view.addEventListener(
    'blur',
    () => {
      browser.boundaryAt = 0;
    },
    { signal },
  );
}
