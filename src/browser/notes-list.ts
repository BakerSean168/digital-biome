import {
  createNotesCatalogLoader,
  getNextNoteBatch,
} from './notes-catalog';
import {
  filterNoteCatalog,
  type NoteCatalogItem,
} from '../view-models/note-list-item';

type NotesPageStrings = {
  totalCount: string;
  searchCount: string;
  uncategorized: string;
};

type NotesListObserver = {
  observe(target: Element): void;
};

export interface NotesListDependencies {
  loadCatalog?: () => Promise<NoteCatalogItem[]>;
  createObserver?: (onIntersect: (isIntersecting: boolean) => void) => NotesListObserver;
}

function getPageStrings(page: HTMLElement): NotesPageStrings {
  const raw = page.dataset.notesI18n;
  if (!raw) {
    return { totalCount: '', searchCount: '', uncategorized: '' };
  }
  return JSON.parse(raw) as NotesPageStrings;
}

function displayTag(tag: string): string {
  const parts = tag.split('/');
  return parts[parts.length - 1] || tag;
}

function createTagElement(tag: string, clickable: boolean): HTMLSpanElement {
  const tagElement = document.createElement('span');
  tagElement.className = 'inline-block px-2 py-0.5 border border-border text-[10px] font-mono text-muted-foreground cursor-pointer hover:border-primary/40 transition-colors';
  tagElement.dataset.cardTag = tag;
  tagElement.title = tag;
  tagElement.textContent = `#${displayTag(tag)}`;
  if (!clickable) tagElement.classList.remove('cursor-pointer');
  return tagElement;
}

function createCard(note: NoteCatalogItem, uncategorized: string): HTMLAnchorElement {
  const card = document.createElement('a');
  card.href = note.href;
  card.className = 'group flex flex-col p-6 bg-transparent border border-border transition-all duration-300 hover:border-primary/40 hover:bg-card/40';

  const tags = document.createElement('div');
  tags.className = 'mb-4 flex flex-wrap gap-2';
  if (note.tags.length > 0) {
    note.tags.forEach(tag => tags.appendChild(createTagElement(tag, true)));
  } else {
    const emptyTag = document.createElement('span');
    emptyTag.className = 'inline-block px-2 py-0.5 border border-border text-[10px] font-mono text-muted-foreground';
    emptyTag.textContent = uncategorized;
    tags.appendChild(emptyTag);
  }

  const title = document.createElement('h3');
  title.className = 'text-lg font-serif text-foreground mb-3 line-clamp-1 group-hover:text-primary transition-colors';
  title.textContent = note.title;

  const description = document.createElement('p');
  description.className = 'text-sm text-muted-foreground mb-6 line-clamp-2 leading-relaxed flex-grow';
  description.textContent = note.description;

  const date = document.createElement('div');
  date.className = 'flex items-center gap-1.5 text-xs text-muted-foreground mt-auto';
  const dateIcon = document.createElement('span');
  dateIcon.setAttribute('aria-hidden', 'true');
  dateIcon.textContent = '◷';
  const dateText = document.createElement('span');
  dateText.textContent = note.date;
  date.append(dateIcon, dateText);

  card.append(tags, title, description, date);
  return card;
}

function parseInitialTags(searchParams: URLSearchParams): string[] {
  return [...new Set(searchParams.getAll('tag')
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean))];
}

export function initializeNotesList(dependencies: NotesListDependencies = {}): void {
  const page = document.getElementById('notes-page');
  const list = document.getElementById('notes-list');
  const empty = document.getElementById('empty-msg');
  const count = document.getElementById('result-count');
  const titleInput = document.getElementById('title-search') as HTMLInputElement | null;
  const clearButton = document.getElementById('clear-filters');
  const tagInput = document.getElementById('tag-search') as HTMLInputElement | null;
  const tagContainer = document.getElementById('tag-container');
  const tagWrapper = document.getElementById('tag-input-wrapper');
  const sentinel = document.getElementById('load-more-sentinel');
  const catalogError = document.getElementById('catalog-error');
  const retryCatalog = document.getElementById('retry-catalog');
  if (!page || !list || !empty || !count || !titleInput || !tagInput || !tagContainer || !sentinel || !catalogError) return;

  const strings = getPageStrings(page);
  const totalCount = Number(page.dataset.totalCount || 0);
  const initialCards = Number(page.dataset.initialCount || 0);
  let activeTags = parseInitialTags(new URL(window.location.href).searchParams);
  let currentNotes: NoteCatalogItem[] = [];
  let displayCount = initialCards;
  let catalog: NoteCatalogItem[] | null = null;
  let showingFilteredResults = false;
  let loadingMore = false;
  let catalogStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  let viewGeneration = 0;

  const nextViewGeneration = () => ++viewGeneration;
  const isCurrentView = (generation: number) => generation === viewGeneration;

  const updateCount = () => {
    const template = showingFilteredResults ? strings.searchCount : strings.totalCount;
    count.textContent = template
      .replace('{total}', String(showingFilteredResults ? currentNotes.length : totalCount))
      .replace('{count}', String(displayCount));
  };

  const hasMore = () => showingFilteredResults || catalog !== null
    ? displayCount < currentNotes.length
    : displayCount < totalCount;

  const updateSentinel = () => {
    if (!hasMore()) sentinel.classList.add('hidden');
    else sentinel.classList.remove('hidden');
  };

  const clearCatalogError = () => {
    if (catalogStatus === 'error') catalogStatus = 'idle';
    catalogError.classList.add('hidden');
  };

  const showCatalogError = (clearCards: boolean) => {
    catalogStatus = 'error';
    catalogError.classList.remove('hidden');
    sentinel.classList.add('hidden');
    if (clearCards) {
      currentNotes = [];
      displayCount = 0;
      showingFilteredResults = true;
      list.replaceChildren();
      list.classList.add('hidden');
      empty.classList.add('hidden');
    }
    updateCount();
  };

  const renderTags = () => {
    tagContainer.replaceChildren();
    activeTags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'flex items-center gap-1 px-2 py-0.5 bg-primary/5 border border-primary/20 text-[11px] font-mono text-primary';
      const label = document.createElement('span');
      label.textContent = `#${displayTag(tag)}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'text-primary/70 hover:text-primary focus:outline-none';
      remove.dataset.removeTag = tag;
      remove.title = tag;
      remove.setAttribute('aria-label', `Remove ${tag}`);
      remove.textContent = '×';
      tagElement.append(label, remove);
      tagContainer.appendChild(tagElement);
    });
  };

  const appendNotes = (notes: NoteCatalogItem[]) => {
    const fragment = document.createDocumentFragment();
    notes.forEach(note => fragment.appendChild(createCard(note, strings.uncategorized)));
    list.appendChild(fragment);
  };

  const renderNotes = (notes: NoteCatalogItem[], filtered: boolean) => {
    currentNotes = notes;
    displayCount = 0;
    showingFilteredResults = filtered;
    list.replaceChildren();
    if (notes.length === 0) {
      list.classList.add('hidden');
      empty.classList.remove('hidden');
      sentinel.classList.add('hidden');
      updateCount();
      return;
    }

    list.classList.remove('hidden');
    empty.classList.add('hidden');
    const initialBatch = getNextNoteBatch(notes, 0);
    appendNotes(initialBatch);
    displayCount = initialBatch.length;
    updateCount();
    updateSentinel();
  };

  const loadCatalog = dependencies.loadCatalog ?? createNotesCatalogLoader();

  const ensureCatalog = async (generation: number): Promise<NoteCatalogItem[]> => {
    if (catalog) return catalog;
    if (isCurrentView(generation)) catalogStatus = 'loading';
    try {
      const notes = await loadCatalog();
      if (isCurrentView(generation)) {
        catalog = notes;
        catalogStatus = 'ready';
      }
      return notes;
    } catch (error) {
      if (isCurrentView(generation)) catalogStatus = 'error';
      throw error;
    }
  };

  const applyFilters = async () => {
    const generation = nextViewGeneration();
    const query = titleInput.value.trim();
    const tags = [...activeTags];
    const filtered = query.length > 0 || tags.length > 0;
    clearCatalogError();
    if (!filtered && !catalog) {
      showingFilteredResults = false;
      updateCount();
      updateSentinel();
      return;
    }

    try {
      const allNotes = await ensureCatalog(generation);
      if (!isCurrentView(generation)) return;
      const notes = filterNoteCatalog(allNotes, query, tags);
      renderNotes(notes, filtered);
    } catch {
      if (isCurrentView(generation)) showCatalogError(filtered);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore()) return;
    const generation = nextViewGeneration();
    const query = titleInput.value.trim();
    const tags = [...activeTags];
    const filtered = query.length > 0 || tags.length > 0;
    loadingMore = true;
    clearCatalogError();
    try {
      if (!catalog) {
        const allNotes = await ensureCatalog(generation);
        if (!isCurrentView(generation)) return;
        if (filtered) {
          renderNotes(filterNoteCatalog(allNotes, query, tags), true);
          return;
        }

        currentNotes = allNotes;
        showingFilteredResults = false;
        const nextBatch = getNextNoteBatch(allNotes, displayCount);
        appendNotes(nextBatch);
        displayCount += nextBatch.length;
        updateCount();
        updateSentinel();
        return;
      }

      if (filtered) {
        renderNotes(filterNoteCatalog(catalog, query, tags), true);
        return;
      }
      currentNotes = catalog;
      showingFilteredResults = false;
      const nextBatch = getNextNoteBatch(catalog, displayCount);
      appendNotes(nextBatch);
      displayCount += nextBatch.length;
      updateCount();
      updateSentinel();
    } catch {
      if (isCurrentView(generation)) showCatalogError(filtered);
    } finally {
      loadingMore = false;
    }
  };

  const observer = dependencies.createObserver
    ? dependencies.createObserver(isIntersecting => {
      if (isIntersecting) void loadMore();
    })
    : typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(entries => {
        if (entries[0]?.isIntersecting) void loadMore();
      }, { rootMargin: '200px' });

  list.addEventListener('click', event => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-card-tag]')
      : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    const tag = target.dataset.cardTag;
    if (tag && !activeTags.includes(tag)) {
      activeTags.push(tag);
      renderTags();
      void applyFilters();
    }
  });

  tagContainer.addEventListener('click', event => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('[data-remove-tag]')
      : null;
    if (!target) return;
    activeTags = activeTags.filter(tag => tag !== target.dataset.removeTag);
    renderTags();
    void applyFilters();
  });

  titleInput.addEventListener('input', () => void applyFilters());
  retryCatalog?.addEventListener('click', () => {
    const filtered = titleInput.value.trim().length > 0 || activeTags.length > 0;
    if (filtered) void applyFilters();
    else void loadMore();
  });
  clearButton?.addEventListener('click', () => {
    titleInput.value = '';
    tagInput.value = '';
    activeTags = [];
    renderTags();
    void applyFilters();
  });

  tagWrapper?.addEventListener('click', () => tagInput.focus());
  tagInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const newTag = tagInput.value.trim();
      if (newTag && !activeTags.includes(newTag)) {
        activeTags.push(newTag);
        tagInput.value = '';
        renderTags();
        void applyFilters();
      }
    } else if (event.key === 'Backspace' && tagInput.value === '' && activeTags.length > 0) {
      activeTags.pop();
      renderTags();
      void applyFilters();
    }
  });

  const searchParams = new URL(window.location.href).searchParams;
  titleInput.value = searchParams.get('q') || '';
  renderTags();
  currentNotes = [];
  updateCount();
  updateSentinel();
  observer?.observe(sentinel);
  if (titleInput.value.trim() || activeTags.length > 0) void applyFilters();
}
