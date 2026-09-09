import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeNotesList } from './notes-list';
import type { NoteCatalogItem } from '../view-models/note-list-item';

class FakeClassList {
  private readonly values = new Set<string>();

  add(...names: string[]): void {
    names.forEach(name => this.values.add(name));
  }

  remove(...names: string[]): void {
    names.forEach(name => this.values.delete(name));
  }

  toggle(name: string, force?: boolean): boolean {
    const next = force === undefined ? !this.values.has(name) : force;
    if (next) this.values.add(name);
    else this.values.delete(name);
    return next;
  }

  contains(name: string): boolean {
    return this.values.has(name);
  }
}

type FakeListener = (event: Record<string, unknown>) => void;

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly classList = new FakeClassList();
  readonly dataset: Record<string, string> = {};
  private ownText = '';
  private readonly listeners = new Map<string, FakeListener[]>();
  className = '';
  href = '';
  value = '';

  get textContent(): string {
    return this.ownText + this.children.map(child => child.textContent).join('');
  }

  set textContent(value: string) {
    this.ownText = value;
    this.children.length = 0;
  }

  appendChild(child: FakeElement | FakeFragment): FakeElement | FakeFragment {
    if (child instanceof FakeFragment) {
      this.children.push(...child.children);
      child.children.length = 0;
    } else {
      this.children.push(child);
    }
    return child;
  }

  append(...children: FakeElement[]): void {
    children.forEach(child => this.appendChild(child));
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.length = 0;
    children.forEach(child => this.appendChild(child));
  }

  addEventListener(type: string, listener: FakeListener): void {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string, event: Record<string, unknown> = {}): void {
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(listener => listener({
      target: this,
      preventDefault: () => {},
      stopPropagation: () => {},
      ...event,
    }));
  }

  focus(): void {}

  setAttribute(name: string, value: string): void {
    if (name.startsWith('data-')) this.dataset[name.slice(5)] = value;
  }
}

class FakeFragment extends FakeElement {}

class FakeDocument {
  readonly body = { style: { overflow: '' } };

  constructor(private readonly elements: Map<string, FakeElement>) {}

  getElementById(id: string): FakeElement | null {
    return this.elements.get(id) || null;
  }

  createElement(): FakeElement {
    return new FakeElement();
  }

  createDocumentFragment(): FakeFragment {
    return new FakeFragment();
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolveValue, rejectValue) => {
    resolve = resolveValue;
    reject = rejectValue;
  });
  return { promise, resolve, reject };
}

function note(index: number, title = `Note ${index}`, tags: string[] = []): NoteCatalogItem {
  return {
    id: `obsidian/note-${index}`,
    title,
    description: `Description ${index}`,
    href: `/notes/obsidian/note-${index}`,
    tags,
    date: '今天',
    timestamp: index,
  };
}

function createEnvironment(): {
  document: FakeDocument;
  elements: Record<string, FakeElement>;
  triggerIntersection: (isIntersecting: boolean) => void;
} {
  const ids = [
    'notes-page',
    'notes-list',
    'empty-msg',
    'result-count',
    'title-search',
    'clear-filters',
    'tag-search',
    'tag-container',
    'tag-input-wrapper',
    'load-more-sentinel',
    'catalog-error',
    'retry-catalog',
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeElement()])) as Record<string, FakeElement>;
  elements['notes-page'].dataset.totalCount = '24';
  elements['notes-page'].dataset.initialCount = '12';
  elements['notes-page'].dataset.notesI18n = JSON.stringify({
    totalCount: 'TOTAL {total} / {count}',
    searchCount: 'FILTERED {total} / {count}',
    uncategorized: 'UNCATEGORIZED',
  });
  for (let index = 0; index < 12; index += 1) {
    const card = new FakeElement();
    card.dataset.noteCard = '';
    card.dataset.noteId = `obsidian/note-${index}`;
    elements['notes-list'].appendChild(card);
  }
  elements['load-more-sentinel'].classList.add('hidden');
  elements['catalog-error'].classList.add('hidden');
  const document = new FakeDocument(new Map(Object.entries(elements)));
  return { document, elements, triggerIntersection: (_isIntersecting: boolean) => {} };
}

function installEnvironment(document: FakeDocument): () => void {
  const globalObject = globalThis as unknown as { document?: unknown; window?: unknown };
  const previousDocument = globalObject.document;
  const previousWindow = globalObject.window;
  globalObject.document = document;
  globalObject.window = { location: { href: 'https://example.test/notes' } };
  return () => {
    if (previousDocument === undefined) delete globalObject.document;
    else globalObject.document = previousDocument;
    if (previousWindow === undefined) delete globalObject.window;
    else globalObject.window = previousWindow;
  };
}

async function settle<T>(promise: Promise<T>): Promise<T> {
  const value = await promise;
  await Promise.resolve();
  await Promise.resolve();
  return value;
}

async function settleMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test('initializes Notes lazily and appends one cached batch through IntersectionObserver', async () => {
  const environment = createEnvironment();
  const catalog = Array.from({ length: 24 }, (_, index) => note(index));
  const request = deferred<NoteCatalogItem[]>();
  let requestCount = 0;
  const restore = installEnvironment(environment.document);
  try {
    initializeNotesList({
      loadCatalog: () => {
        requestCount += 1;
        return request.promise;
      },
      createObserver: callback => {
        environment.triggerIntersection = callback;
        return { observe: () => {} };
      },
    });
    assert.equal(requestCount, 0);
    assert.equal(environment.elements['notes-list'].children.length, 12);

    environment.triggerIntersection(true);
    environment.triggerIntersection(true);
    assert.equal(requestCount, 1);
    request.resolve(catalog);
    await settle(request.promise);

    assert.equal(environment.elements['notes-list'].children.length, 24);
    assert.match(environment.elements['notes-list'].children[12]?.textContent || '', /Note 12/);
    assert.match(environment.elements['notes-list'].children[23]?.textContent || '', /Note 23/);
    assert.equal(requestCount, 1);
    environment.triggerIntersection(true);
    await settleMicrotasks();
    assert.equal(requestCount, 1);
  } finally {
    restore();
  }
});

test('handles load-more rejection without corrupting SSR cards and retries successfully', async () => {
  const environment = createEnvironment();
  const firstRequest = deferred<NoteCatalogItem[]>();
  const secondRequest = deferred<NoteCatalogItem[]>();
  let requestCount = 0;
  const restore = installEnvironment(environment.document);
  try {
    initializeNotesList({
      loadCatalog: () => {
        requestCount += 1;
        return requestCount === 1 ? firstRequest.promise : secondRequest.promise;
      },
      createObserver: callback => {
        environment.triggerIntersection = callback;
        return { observe: () => {} };
      },
    });
    environment.triggerIntersection(true);
    firstRequest.reject(new Error('catalog unavailable'));
    await assert.rejects(firstRequest.promise);
    await settleMicrotasks();

    assert.equal(environment.elements['notes-list'].children.length, 12);
    assert.equal(environment.elements['catalog-error'].classList.contains('hidden'), false);
    assert.match(environment.elements['result-count'].textContent, /^TOTAL 24 \/ 12$/);

    environment.elements['retry-catalog'].dispatch('click');
    secondRequest.resolve(Array.from({ length: 24 }, (_, index) => note(index)));
    await settle(secondRequest.promise);
    assert.equal(environment.elements['notes-list'].children.length, 24);
    assert.equal(environment.elements['catalog-error'].classList.contains('hidden'), true);
    assert.equal(requestCount, 2);
  } finally {
    restore();
  }
});

test('clearing filters supersedes a pending catalog resolution and preserves SSR state', async () => {
  const environment = createEnvironment();
  const request = deferred<NoteCatalogItem[]>();
  const restore = installEnvironment(environment.document);
  try {
    initializeNotesList({
      loadCatalog: () => request.promise,
      createObserver: callback => {
        environment.triggerIntersection = callback;
        return { observe: () => {} };
      },
    });
    environment.elements['title-search'].value = 'query';
    environment.elements['title-search'].dispatch('input');
    environment.elements['clear-filters'].dispatch('click');
    assert.equal(environment.elements['notes-list'].children.length, 12);
    assert.equal(environment.elements['result-count'].textContent, 'TOTAL 24 / 12');

    request.resolve(Array.from({ length: 24 }, (_, index) => note(index)));
    await settle(request.promise);
    assert.equal(environment.elements['notes-list'].children.length, 12);
    assert.equal(environment.elements['result-count'].textContent, 'TOTAL 24 / 12');
    assert.equal(environment.elements['catalog-error'].classList.contains('hidden'), true);
  } finally {
    restore();
  }
});

test('clearing filters supersedes a pending catalog rejection without stale error state', async () => {
  const environment = createEnvironment();
  const request = deferred<NoteCatalogItem[]>();
  const restore = installEnvironment(environment.document);
  try {
    initializeNotesList({
      loadCatalog: () => request.promise,
      createObserver: callback => {
        environment.triggerIntersection = callback;
        return { observe: () => {} };
      },
    });
    environment.elements['title-search'].value = 'query';
    environment.elements['title-search'].dispatch('input');
    environment.elements['clear-filters'].dispatch('click');
    request.reject(new Error('catalog unavailable'));
    await assert.rejects(request.promise);
    await settleMicrotasks();

    assert.equal(environment.elements['notes-list'].children.length, 12);
    assert.equal(environment.elements['result-count'].textContent, 'TOTAL 24 / 12');
    assert.equal(environment.elements['catalog-error'].classList.contains('hidden'), true);
  } finally {
    restore();
  }
});

test('keeps the latest query and tag filter when deferred requests resolve out of order', async () => {
  const environment = createEnvironment();
  const queryRequest = deferred<NoteCatalogItem[]>();
  const tagRequest = deferred<NoteCatalogItem[]>();
  let requestCount = 0;
  const restore = installEnvironment(environment.document);
  try {
    initializeNotesList({
      loadCatalog: () => {
        requestCount += 1;
        return requestCount === 1 ? queryRequest.promise : tagRequest.promise;
      },
      createObserver: callback => {
        environment.triggerIntersection = callback;
        return { observe: () => {} };
      },
    });
    environment.elements['title-search'].value = 'alpha';
    environment.elements['title-search'].dispatch('input');
    environment.elements['title-search'].value = '';
    environment.elements['tag-search'].value = 'tag/beta';
    environment.elements['tag-search'].dispatch('keydown', { key: 'Enter' });
    assert.equal(requestCount, 2);

    tagRequest.resolve([note(1, 'Beta result', ['tag/beta'])]);
    await settle(tagRequest.promise);
    queryRequest.resolve([note(2, 'Alpha result', ['tag/alpha'])]);
    await settle(queryRequest.promise);

    assert.equal(environment.elements['notes-list'].children.length, 1);
    assert.match(environment.elements['notes-list'].children[0]?.textContent || '', /Beta result/);
    assert.equal(environment.elements['result-count'].textContent, 'FILTERED 1 / 1');
  } finally {
    restore();
  }
});
