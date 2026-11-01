import assert from 'node:assert/strict';
import test from 'node:test';
import { initSiteSearch } from './site-search-controller';

function fakeSearchDocument(): {
  root: Document;
  dialog: HTMLDialogElement;
  documentListeners: () => number;
} {
  const events = new EventTarget();
  const modalEvents = new EventTarget();
  let open = false;
  const classNames = new Set(['hidden']);
  const attributes = new Map<string, string>();
  const dialog = Object.assign(modalEvents, {
    classList: {
      add: (name: string) => classNames.add(name),
      remove: (name: string) => classNames.delete(name),
      contains: (name: string) => classNames.has(name),
    },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    showModal: () => {
      open = true;
    },
    close: () => {
      open = false;
    },
    get open() {
      return open;
    },
  }) as unknown as HTMLDialogElement;
  let keydownListenerCount = 0;
  const root = Object.assign(events, {
    querySelector: (selector: string) => (selector === '#search-modal' ? dialog : null),
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: (type: string, handler: EventListenerOrEventListenerObject) => {
      if (type === 'keydown') keydownListenerCount++;
      EventTarget.prototype.addEventListener.call(events, type, handler);
    },
    removeEventListener: (type: string, handler: EventListenerOrEventListenerObject) => {
      if (type === 'keydown') keydownListenerCount--;
      EventTarget.prototype.removeEventListener.call(events, type, handler);
    },
  }) as unknown as Document;

  return { root, dialog, documentListeners: () => keydownListenerCount };
}

test('initializing Search twice for one dialog reuses its listeners and disposer', () => {
  const { root, dialog, documentListeners } = fakeSearchDocument();
  const first = initSiteSearch(root);
  const second = initSiteSearch(root);
  assert.equal(first, second);
  assert.equal(documentListeners(), 1);
  first();
  assert.equal(dialog.open, false);
  assert.equal(documentListeners(), 0);
  const next = initSiteSearch(root);
  assert.notEqual(next, first);
  assert.equal(documentListeners(), 1);
  next();
  assert.equal(documentListeners(), 0);
});

test('controller setup with no Search dialog leaves no global keydown listener', () => {
  const { root, documentListeners } = fakeSearchDocument();
  Object.assign(root, { querySelector: () => null });
  const cleanup = initSiteSearch(root);
  assert.equal(documentListeners(), 0);
  cleanup();
  assert.equal(documentListeners(), 0);
});
