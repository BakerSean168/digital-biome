import type { Bookmark } from '../types/notes';
import {
  countToolCatalogCards,
  filterToolCatalog,
  type ToolCatalogGroup,
} from '../view-models/tools-catalog';
import { createToolsCatalogLoader } from './tools-catalog';

interface BookmarkGridObserver {
  observe(target: Element): void;
  disconnect?(): void;
}

export interface BookmarkGridDependencies {
  loadCatalog?: () => Promise<ToolCatalogGroup[]>;
  createObserver?: (onIntersect: (isIntersecting: boolean) => void) => BookmarkGridObserver;
}

function createFaviconBox(bookmark: Bookmark): HTMLDivElement {
  const box = document.createElement('div');
  box.className =
    'favicon-box w-10 h-10 border border-border flex items-center justify-center bg-background text-foreground shrink-0 rounded-none overflow-hidden relative group-hover:border-primary/30 transition-colors';

  let domain = 'example.com';
  try {
    domain = new URL(bookmark.url).hostname;
  } catch {
    // Keep deterministic fallback domain.
  }

  const image = document.createElement('img');
  image.src = `/favicons/${domain}.png`;
  image.alt = `${bookmark.title} favicon`;
  image.className =
    'w-5 h-5 object-contain transition-transform duration-200 group-hover:scale-110';
  image.loading = 'lazy';
  let triedRemoteFallback = false;
  image.addEventListener('error', () => {
    if (!triedRemoteFallback) {
      triedRemoteFallback = true;
      image.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
      return;
    }
    const fallback = document.createElement('div');
    fallback.className =
      'w-full h-full text-primary bg-primary/10 flex items-center justify-center font-mono font-bold text-xs select-none';
    fallback.textContent = `[${bookmark.title.charAt(0).toUpperCase() || '?'}]`;
    box.replaceChildren(fallback);
  });
  box.appendChild(image);
  return box;
}

function createBookmarkCard(bookmark: Bookmark): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'bookmark-card-item relative group/card flex flex-col w-full';
  card.dataset.bookmarkCard = '';
  card.dataset.bookmarkSlug = bookmark.slug;
  card.dataset.title = bookmark.title;
  card.dataset.description = bookmark.description ?? '';
  card.dataset.categories = JSON.stringify(bookmark.categories);

  const anchor = document.createElement('a');
  anchor.href = bookmark.url;
  anchor.className =
    'card-anchor group flex items-center gap-3 p-3 border border-border bg-card hover:border-primary/50 hover:bg-primary/[0.02] transition-all duration-200 rounded-none w-full relative';
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';

  const cursor = document.createElement('div');
  cursor.className =
    'kb-cursor-indicator absolute -left-2.5 top-1/2 -translate-y-1/2 text-primary font-mono font-bold text-xs opacity-0 invisible transition-all duration-150 pointer-events-none select-none z-10 animate-pulse';
  cursor.textContent = '>';

  let domain = 'example.com';
  try {
    domain = new URL(bookmark.url).hostname;
  } catch {
    // Keep deterministic fallback domain.
  }

  const details = document.createElement('div');
  details.className = 'flex flex-col min-w-0 flex-1';
  const title = document.createElement('span');
  title.className =
    'card-title text-sm font-mono font-semibold text-foreground truncate group-hover:text-primary transition-colors';
  title.textContent = bookmark.title;
  const domainLine = document.createElement('span');
  domainLine.className =
    'text-[10px] font-mono text-muted-foreground tracking-tight truncate mt-0.5 flex items-center gap-1 select-none';
  domainLine.textContent = `↗ ${domain}`;
  details.append(title, domainLine);

  anchor.append(cursor, createFaviconBox(bookmark), details);
  card.appendChild(anchor);

  if (bookmark.description) {
    const tooltip = document.createElement('div');
    tooltip.className =
      'diagnostic-tooltip absolute bottom-[calc(100%-8px)] mb-2 left-1/2 -translate-x-1/2 w-max max-w-[240px] px-3 py-2 bg-card border border-primary/40 text-foreground text-[10px] leading-relaxed rounded-none opacity-0 invisible group-hover/card:opacity-100 group-hover/card:visible translate-y-2 group-hover/card:translate-y-0 transition-all duration-200 z-50 whitespace-normal text-left pointer-events-none font-mono shadow-none';
    const label = document.createElement('div');
    label.className =
      'text-[9px] text-primary mb-1 border-b border-primary/20 pb-0.5 select-none font-bold tracking-widest';
    label.textContent = '[ DIAGNOSTIC_INFO ]';
    const text = document.createTextNode(bookmark.description);
    tooltip.append(label, text);
    card.appendChild(tooltip);
  }

  return card;
}

function createCategorySection(group: ToolCatalogGroup): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'bookmark-category-section w-full border-t border-border/40 pt-6';
  section.dataset.categorySectionName = group.slug;

  const category = document.createElement('div');
  category.className = 'bookmark-category-container mb-6 w-full';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-6 font-mono';
  const title = document.createElement('h3');
  title.className =
    'text-base font-bold text-foreground tracking-widest uppercase flex items-center gap-2';
  title.textContent = `[ ${group.name} ]`;
  const badge = document.createElement('div');
  badge.className =
    'px-3 py-1 bg-primary/10 text-primary text-[10px] border border-primary/20 rounded-none font-medium category-count-badge select-none';
  const visible = document.createElement('span');
  visible.className = 'category-visible-count font-bold';
  visible.textContent = String(group.bookmarks.length);
  badge.append(visible, document.createTextNode(` / ${group.bookmarks.length} UNITS`));
  header.append(title, badge);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
  group.bookmarks.forEach((bookmark) => {
    grid.appendChild(createBookmarkCard(bookmark));
  });

  category.append(header, grid);
  section.appendChild(category);
  return section;
}

function renderGroups(container: HTMLElement, groups: readonly ToolCatalogGroup[]): void {
  const fragment = document.createDocumentFragment();
  groups.forEach((group) => {
    fragment.appendChild(createCategorySection(group));
  });
  container.replaceChildren(fragment);
}

function activateStaticFaviconFallbacks(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>('img[data-bookmark-favicon]').forEach((image) => {
    if (image.dataset.fallbackInitialized === 'true') return;
    image.dataset.fallbackInitialized = 'true';
    let triedRemoteFallback = false;
    image.addEventListener('error', () => {
      if (!triedRemoteFallback) {
        triedRemoteFallback = true;
        const fallbackUrl = image.dataset.fallbackUrl;
        if (fallbackUrl) {
          image.src = fallbackUrl;
          return;
        }
      }
      const parent = image.parentElement;
      if (!parent) return;
      const fallback = document.createElement('div');
      fallback.className =
        'w-full h-full text-primary bg-primary/10 flex items-center justify-center font-mono font-bold text-xs select-none';
      fallback.textContent = `[${image.dataset.fallbackLetter || '?'}]`;
      parent.replaceChildren(fallback);
    });
  });
}

export function initializeBookmarkGrid(dependencies: BookmarkGridDependencies = {}): void {
  const page = document.getElementById('bookmark-grid-container') as HTMLElement | null;
  if (!page || page.dataset.gridInitialized === 'true') return;
  page.dataset.gridInitialized = 'true';

  const searchInput = document.getElementById('bookmark-search-input') as HTMLInputElement | null;
  const filterButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.bookmark-filter-btn'),
  );
  const categoriesContainer = document.getElementById('bookmarks-categories-container');
  const emptyState = document.getElementById('bookmark-empty-state');
  const resetBtn = document.getElementById('bookmark-reset-btn');
  const currentFilterLabel = document.querySelector<HTMLElement>('.id-current-filter');
  const statsTotalCount = document.getElementById('stats-total-count');
  const catalogError = document.getElementById('bookmark-catalog-error');
  const retryCatalog = document.getElementById('bookmark-retry-catalog');
  const loadMore = document.getElementById('bookmark-load-more');
  const loadMoreSentinel = document.getElementById('bookmark-load-more-sentinel');
  if (
    !searchInput ||
    filterButtons.length === 0 ||
    !categoriesContainer ||
    !emptyState ||
    !catalogError
  )
    return;

  const search = searchInput;
  const container = categoriesContainer;
  const empty = emptyState;
  const errorBanner = catalogError;

  const totalCount = Number(page.dataset.totalCount || 0);
  const initialSections = Array.from(container.children);
  const loadCatalog = dependencies.loadCatalog ?? createToolsCatalogLoader();
  let catalog: ToolCatalogGroup[] | null = null;
  let activeCardIndex = -1;
  let viewGeneration = 0;

  const url = new URL(window.location.href);
  search.value = url.searchParams.get('q') || '';
  let activeCategory = (url.searchParams.get('c') || 'all').toLowerCase();
  if (!filterButtons.some((button) => button.dataset.category === activeCategory))
    activeCategory = 'all';

  function setActiveButton(category: string): void {
    activeCategory = category;
    filterButtons.forEach((button) => {
      const active = button.dataset.category === category;
      button.classList.toggle('bg-primary', active);
      button.classList.toggle('text-background', active);
      button.classList.toggle('border-primary', active);
      button.classList.toggle('text-muted-foreground', !active);
      button.classList.toggle('border-border', !active);
    });
    if (currentFilterLabel) currentFilterLabel.textContent = category.toUpperCase();
  }

  function syncUrl(): void {
    const next = new URL(window.location.href);
    const query = search.value.trim();
    if (query) next.searchParams.set('q', query);
    else next.searchParams.delete('q');
    if (activeCategory !== 'all') next.searchParams.set('c', activeCategory);
    else next.searchParams.delete('c');
    window.history.replaceState({}, '', next.toString());
  }

  function getVisibleCards(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('.bookmark-card-item'));
  }

  function setActiveCardIndex(index: number): void {
    const cards = getVisibleCards();
    container.querySelectorAll('.bookmark-card-item.kb-active').forEach((card) => {
      card.classList.remove('kb-active');
    });
    if (cards.length === 0 || index < 0) {
      activeCardIndex = -1;
      return;
    }
    activeCardIndex = Math.max(0, Math.min(index, cards.length - 1));
    const card = cards[activeCardIndex];
    card.classList.add('kb-active');
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function getGridColumns(cards: HTMLElement[], currentIndex: number): number {
    if (cards.length <= 1 || currentIndex < 0 || currentIndex >= cards.length) return 1;
    const current = cards[currentIndex];
    const grid = current.parentElement;
    if (!grid) return 1;
    const top = current.offsetTop;
    return (
      cards.filter((card) => card.parentElement === grid && Math.abs(card.offsetTop - top) < 10)
        .length || 1
    );
  }

  function updateResultState(groups: readonly ToolCatalogGroup[], filtered: boolean): void {
    const visibleCount = filtered ? countToolCatalogCards(groups) : totalCount;
    if (statsTotalCount) statsTotalCount.textContent = `${visibleCount} UNITS`;
    container.classList.toggle('hidden', groups.length === 0);
    empty.classList.toggle('hidden', groups.length !== 0);
    if (loadMoreSentinel) loadMoreSentinel.classList.toggle('hidden', catalog !== null || filtered);
  }

  function restoreInitial(): void {
    container.replaceChildren(...initialSections);
    container.classList.remove('hidden');
    empty.classList.add('hidden');
    if (statsTotalCount) statsTotalCount.textContent = `${totalCount} UNITS`;
    if (loadMoreSentinel) loadMoreSentinel.classList.remove('hidden');
  }

  async function ensureCatalog(generation: number): Promise<ToolCatalogGroup[]> {
    if (catalog) return catalog;
    const groups = await loadCatalog();
    if (generation === viewGeneration) catalog = groups;
    return groups;
  }

  function showCatalogError(): void {
    errorBanner.classList.remove('hidden');
  }

  function clearCatalogError(): void {
    errorBanner.classList.add('hidden');
  }

  async function applyFilters(): Promise<void> {
    const generation = ++viewGeneration;
    setActiveCardIndex(-1);
    syncUrl();
    clearCatalogError();
    const query = search.value.trim();
    const filtered = Boolean(query) || activeCategory !== 'all';

    if (!filtered && !catalog) {
      restoreInitial();
      return;
    }

    try {
      const groups = await ensureCatalog(generation);
      if (generation !== viewGeneration) return;
      const visible = filterToolCatalog(groups, query, activeCategory);
      renderGroups(container, visible);
      updateResultState(visible, filtered);
    } catch {
      if (generation === viewGeneration) showCatalogError();
    }
  }

  async function revealFullCatalog(): Promise<void> {
    if (catalog) return;
    const generation = ++viewGeneration;
    clearCatalogError();
    try {
      const groups = await ensureCatalog(generation);
      if (generation !== viewGeneration) return;
      renderGroups(container, groups);
      updateResultState(groups, false);
    } catch {
      if (generation === viewGeneration) showCatalogError();
    }
  }

  search.addEventListener('input', () => void applyFilters());
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveButton(button.dataset.category || 'all');
      void applyFilters();
    });
  });
  resetBtn?.addEventListener('click', () => {
    search.value = '';
    setActiveButton('all');
    void applyFilters();
  });
  retryCatalog?.addEventListener('click', () => {
    if (search.value.trim() || activeCategory !== 'all') void applyFilters();
    else void revealFullCatalog();
  });
  loadMore?.addEventListener('click', () => void revealFullCatalog());

  container.addEventListener('mouseover', (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('.bookmark-card-item')
        : null;
    if (!target) return;
    const cards = getVisibleCards();
    const index = cards.indexOf(target);
    if (index >= 0 && index !== activeCardIndex) setActiveCardIndex(index);
  });

  const abort = new AbortController();
  document.addEventListener('astro:before-swap', () => abort.abort(), {
    once: true,
    signal: abort.signal,
  });
  document.addEventListener(
    'keydown',
    (event) => {
      const activeElement = document.activeElement;
      const activeTag = activeElement?.tagName.toLowerCase();
      const cards = getVisibleCards();

      if (event.key === '/' && activeTag !== 'input' && activeTag !== 'textarea') {
        event.preventDefault();
        setActiveCardIndex(-1);
        search.focus();
        search.select();
        return;
      }

      if (activeElement === search && event.key === 'Enter') {
        if (cards.length > 0) {
          event.preventDefault();
          search.blur();
          setActiveCardIndex(0);
        }
        return;
      }

      if (activeCardIndex >= 0) {
        if (event.key === 'Enter') {
          event.preventDefault();
          cards[activeCardIndex]?.querySelector<HTMLAnchorElement>('a')?.click();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setActiveCardIndex(-1);
          search.focus();
          search.select();
          return;
        }
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          setActiveCardIndex(activeCardIndex + (event.key === 'ArrowRight' ? 1 : -1));
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const columns = getGridColumns(cards, activeCardIndex);
          const next = activeCardIndex + (event.key === 'ArrowDown' ? columns : -columns);
          if (next < 0) {
            setActiveCardIndex(-1);
            search.focus();
            search.select();
          } else {
            setActiveCardIndex(next);
          }
          return;
        }
      }

      if (
        activeTag !== 'input' &&
        activeTag !== 'textarea' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const number = Number.parseInt(event.key, 10);
        if (number >= 1 && number <= 9) {
          const button = filterButtons[number - 1];
          if (button) {
            event.preventDefault();
            setActiveButton(button.dataset.category || 'all');
            void applyFilters();
          }
        }
      }
    },
    { signal: abort.signal },
  );

  const observer = dependencies.createObserver
    ? dependencies.createObserver((isIntersecting) => {
        if (isIntersecting) void revealFullCatalog();
      })
    : typeof IntersectionObserver === 'undefined' || !loadMoreSentinel
      ? null
      : new IntersectionObserver(
          (entries) => {
            if (entries[0]?.isIntersecting) void revealFullCatalog();
          },
          { rootMargin: '200px' },
        );
  if (observer && loadMoreSentinel) observer.observe(loadMoreSentinel);

  activateStaticFaviconFallbacks(container);
  setActiveButton(activeCategory);
  if (search.value.trim() || activeCategory !== 'all') void applyFilters();
  else restoreInitial();
}
