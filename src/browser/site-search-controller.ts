import { createSearchIntentScheduler, type SearchIntent } from './search-intent';
import { SEARCH_NAVIGATION_INDEX, type SearchNavigationCommand } from '../config/navigation-policy';
import {
  loadPagefind,
  searchPagefind,
  type PagefindSearchOutcome,
  type PagefindSearchStatus,
} from './pagefind';
import { withUiMode } from '../domain/ui-mode';
import { createSiteSearchServices, type SiteSearchServices } from './site-search-services';
import { matchSearchPalette, toSearchResult, type PaletteResult } from './site-search-results';

export interface SiteSearchDependencies {
  readonly routes?: readonly SearchNavigationCommand[];
  readonly services?: SiteSearchServices;
  readonly fullTextSearch?: (query: string) => Promise<PagefindSearchOutcome>;
}

const mounted = new WeakMap<Document, { dialog: HTMLDialogElement; dispose: () => void }>();

export function initSiteSearch(
  root: Document = document,
  dependencies: SiteSearchDependencies = {},
): () => void {
  const searchModal = root.querySelector<HTMLDialogElement>('#search-modal');
  if (!searchModal) return () => {};

  const previous = mounted.get(root);
  if (previous?.dialog === searchModal) return previous.dispose;
  previous?.dispose();

  const ROUTES = dependencies.routes ?? SEARCH_NAVIGATION_INDEX;
  const services = dependencies.services ?? createSiteSearchServices();
  const fullTextSearch =
    dependencies.fullTextSearch ?? ((query: string) => searchPagefind(loadPagefind, query, 8));

  const searchTriggers = root.querySelectorAll('.search-trigger');
  const cmdInput = root.getElementById('cmd-input') as HTMLInputElement | null;
  const resultsContainer = root.getElementById('cmd-results');
  const loadingIndicator = root.getElementById('cmd-loading');
  const statusElement = root.getElementById('cmd-search-status');
  let selectedIndex = 0;
  let currentResults: PaletteResult[] = [];
  let searchStatus: PagefindSearchStatus = 'success';
  let searchPending = false;
  const searchIntents = createSearchIntentScheduler(200, undefined, () => {
    searchPending = true;
    selectedIndex = 0;
    currentResults = [];
    loadingIndicator?.classList.add('hidden');
    resultsContainer?.replaceChildren();
    searchStatus = 'success';
    renderSearchStatus();
  });

  function renderSearchStatus(): void {
    if (!statusElement) return;
    const messages: Partial<Record<PagefindSearchStatus, string>> = {
      unavailable: '全文索引暂时不可用，仍可使用导航命令。',
      'query-failed': '全文搜索暂时失败，请稍后重试。',
      'hydration-failed': '搜索结果暂时无法加载，请稍后重试。',
      partial: '部分搜索结果暂时无法加载。',
    };
    const message = messages[searchStatus] || '';
    statusElement.textContent = message;
    statusElement.classList.toggle('hidden', !message);
  }

  function renderResults(): void {
    if (!resultsContainer) return;
    resultsContainer.replaceChildren();

    if (currentResults.length === 0) {
      const empty = root.createElement('div');
      empty.className = 'px-4 py-8 text-center font-mono text-xs text-muted-foreground';
      empty.textContent =
        searchStatus === 'zero-match' || searchStatus === 'success'
          ? '没有匹配的内容。'
          : '搜索暂时不可用。';
      resultsContainer.appendChild(empty);
      renderSearchStatus();
      return;
    }

    const fragment = root.createDocumentFragment();
    currentResults.forEach((item, index) => {
      const el = root.createElement('button');
      el.type = 'button';
      el.tabIndex = -1;
      el.id = `search-result-${index}`;
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', String(index === selectedIndex));
      el.className =
        'flex w-full items-center gap-3 border-b border-border px-2 py-2 text-left aria-selected:bg-primary/10';
      el.dataset.index = index.toString();
      const kind = root.createElement('span');
      kind.className = 'w-8 shrink-0 text-[10px] text-muted-foreground';
      kind.textContent = item.type === 'cmd' ? '→' : item.type === 'service' ? 'svc' : 'doc';
      const content = root.createElement('span');
      content.className = 'min-w-0 flex-1';
      const title = root.createElement('span');
      title.className = 'block truncate text-sm text-foreground';
      title.textContent = item.title;
      content.append(title);
      if (item.desc) {
        const description = root.createElement('span');
        description.className = 'block truncate text-xs text-muted-foreground';
        description.textContent = item.desc;
        content.append(description);
      }
      const target = root.createElement('span');
      target.className = 'hidden max-w-40 truncate text-xs text-muted-foreground sm:block';
      target.textContent =
        item.type === 'cmd'
          ? item.href
          : item.type === 'service' && item.privateRef
            ? 'Access'
            : '↗';
      el.append(kind, content, target);
      el.addEventListener('mouseenter', () => {
        selectedIndex = index;
        updateSelection();
      });
      el.addEventListener('click', () => {
        executeItem(index);
      });

      fragment.appendChild(el);
    });

    resultsContainer.appendChild(fragment);
    updateSelection();
    renderSearchStatus();

    const selectedEl = resultsContainer.children[selectedIndex];
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });
  }

  function updateSelection(): void {
    if (!resultsContainer) return;
    Array.from(resultsContainer.children).forEach((child, index) => {
      child.setAttribute('aria-selected', String(index === selectedIndex));
    });
    const selected = resultsContainer.children[selectedIndex];
    if (selected?.id) cmdInput?.setAttribute('aria-activedescendant', selected.id);
    else cmdInput?.removeAttribute('aria-activedescendant');
  }

  function executeItem(index: number): void {
    if (searchPending) return;
    const item = currentResults[index];
    if (!item) return;
    if (item.type === 'service' && /^https?:/.test(item.href)) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.assign(withUiMode(item.href, new URL(location.href)));
    }
  }

  async function handleSearch(intent: SearchIntent): Promise<void> {
    const { query, token } = intent;
    loadingIndicator?.classList.remove('hidden');

    const lowerQuery = query.toLowerCase().trim();
    const results: PaletteResult[] = matchSearchPalette(lowerQuery, ROUTES, services.list());
    searchStatus = 'success';

    if (lowerQuery && !lowerQuery.startsWith('/')) {
      const outcome = await fullTextSearch(lowerQuery);
      if (!token.isCurrent()) return;
      searchStatus = outcome.status;
      results.push(...outcome.results.map(toSearchResult));
    }

    if (!token.isCurrent()) return;
    currentResults = results;
    selectedIndex = 0;
    searchPending = false;
    loadingIndicator?.classList.add('hidden');
    renderResults();
  }

  function openModal(): void {
    if (!searchModal) return;
    searchModal.classList.remove('hidden');
    searchModal.setAttribute('aria-hidden', 'false');
    if (!searchModal.open) searchModal.showModal();
    if (cmdInput) {
      cmdInput.value = '';
      cmdInput.focus();
      void handleSearch(searchIntents.start(''));
      void services.load().then(() => {
        if (!searchModal?.open) return;
        void services.hydratePrivateTargets();
        void handleSearch(searchIntents.start(cmdInput.value));
      });
    }
  }

  function closeModal(): void {
    searchIntents.invalidate();
    searchPending = false;
    currentResults = [];
    selectedIndex = 0;
    loadingIndicator?.classList.add('hidden');
    resultsContainer?.replaceChildren();
    searchStatus = 'success';
    renderSearchStatus();
    if (!searchModal) return;
    searchModal.classList.add('hidden');
    searchModal.setAttribute('aria-hidden', 'true');
    if (searchModal.open) searchModal.close();
    cmdInput?.removeAttribute('aria-activedescendant');
  }

  const closeButton = root.getElementById('cmd-close');
  const onCancel = (event: Event): void => {
    event.preventDefault();
    closeModal();
  };
  const onBackdropClick = (event: MouseEvent): void => {
    if (event.target === searchModal) closeModal();
  };
  const onInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    searchIntents.schedule(target.value, (intent) => void handleSearch(intent));
  };

  searchTriggers.forEach((trigger) => {
    trigger.addEventListener('click', openModal);
  });
  closeButton?.addEventListener('click', closeModal);
  searchModal.addEventListener('cancel', onCancel);
  searchModal.addEventListener('click', onBackdropClick);
  cmdInput?.addEventListener('input', onInput);
  const onKeydown = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229) return;
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      if (searchModal?.classList.contains('hidden')) {
        openModal();
      } else {
        closeModal();
      }
    }

    if (!searchModal?.open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.target !== cmdInput) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (selectedIndex < currentResults.length - 1) {
        selectedIndex++;
        updateSelection();
        const selectedEl = resultsContainer?.children[selectedIndex];
        if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (selectedIndex > 0) {
        selectedIndex--;
        updateSelection();
        const selectedEl = resultsContainer?.children[selectedIndex];
        if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      executeItem(selectedIndex);
    }
  };
  root.addEventListener('keydown', onKeydown);

  const dispose = (): void => {
    closeModal();
    searchTriggers.forEach((trigger) => {
      trigger.removeEventListener('click', openModal);
    });
    closeButton?.removeEventListener('click', closeModal);
    searchModal.removeEventListener('cancel', onCancel);
    searchModal.removeEventListener('click', onBackdropClick);
    cmdInput?.removeEventListener('input', onInput);
    root.removeEventListener('keydown', onKeydown);
    if (mounted.get(root)?.dialog === searchModal) mounted.delete(root);
  };
  mounted.set(root, { dialog: searchModal, dispose });
  return dispose;
}
