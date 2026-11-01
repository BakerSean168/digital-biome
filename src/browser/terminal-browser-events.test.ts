import assert from 'node:assert/strict';
import test from 'node:test';
import { bindTerminalBrowserEvents } from './terminal-browser-events';
import { createTerminalBrowserState } from './terminal-browser-state';

function keyboard(key: string, composing = false): Event {
  return Object.assign(new Event('keydown', { cancelable: true }), {
    key,
    keyCode: composing ? 229 : 0,
    isComposing: composing,
  });
}

function fixture() {
  const owner = new AbortController();
  const root = Object.assign(new EventTarget(), {
    querySelector: () => null,
    closest: () => null,
  }) as unknown as HTMLElement;
  const list = new EventTarget() as unknown as HTMLElement;
  const input = Object.assign(new EventTarget(), {
    value: 'original',
    blurCount: 0,
    blur() {
      this.blurCount++;
    },
  }) as unknown as HTMLInputElement & { blurCount: number };
  const more = new EventTarget() as unknown as HTMLButtonElement;
  const sort = new EventTarget() as unknown as HTMLSelectElement;
  const doc = Object.assign(new EventTarget(), {
    documentElement: { dataset: { ui: 'tui' } },
  }) as unknown as Document;
  const view = new EventTarget() as unknown as Window;
  const state = createTerminalBrowserState([], undefined);
  state.rows = [{} as HTMLAnchorElement];
  let refreshed = 0;
  let loadedMore = 0;
  const selections: Array<[number, boolean | undefined]> = [];
  bindTerminalBrowserEvents({
    root,
    list,
    input,
    more,
    sort,
    doc,
    view,
    browser: state,
    signal: owner.signal,
    status: { textContent: '' } as HTMLElement,
    detail: {} as HTMLDialogElement,
    preview: {} as HTMLElement,
    refresh: async () => {
      refreshed++;
    },
    showMore: async () => {
      loadedMore++;
    },
    select: (index, scroll) => selections.push([index, scroll]),
    hasMore: () => true,
  });
  return {
    root,
    input,
    more,
    sort,
    doc,
    view,
    state,
    owner,
    selections,
    get refreshed() {
      return refreshed;
    },
    get loadedMore() {
      return loadedMore;
    },
  };
}

test('IME composition does not consume Enter; Escape clears query and detaches on abort', () => {
  const app = fixture();
  const composing = keyboard('Enter', true);
  app.input.dispatchEvent(composing);
  assert.equal(composing.defaultPrevented, false);
  assert.equal(app.input.blurCount, 0);
  assert.equal(app.refreshed, 0);

  app.input.dispatchEvent(keyboard('Escape'));
  assert.equal(app.input.value, '');
  assert.equal(app.input.blurCount, 1);
  assert.equal(app.refreshed, 1);

  app.owner.abort();
  app.input.value = 'after dispose';
  app.input.dispatchEvent(keyboard('Escape'));
  assert.equal(app.input.value, 'after dispose');
  assert.equal(app.refreshed, 1);
});

test('input, sorting, explicit load and ArrowDown belong to the active instance only', () => {
  const first = fixture();
  const second = fixture();
  first.input.dispatchEvent(new Event('input'));
  first.sort.dispatchEvent(new Event('change'));
  first.more.dispatchEvent(new Event('click'));
  first.input.dispatchEvent(keyboard('ArrowDown'));
  assert.equal(first.refreshed, 2);
  assert.equal(first.loadedMore, 1);
  assert.deepEqual(first.selections, [[1, true]]);
  assert.equal(second.refreshed, 0);
  assert.deepEqual(second.selections, []);

  first.owner.abort();
  first.sort.dispatchEvent(new Event('change'));
  first.more.dispatchEvent(new Event('click'));
  assert.equal(first.refreshed, 2);
  assert.equal(first.loadedMore, 1);
  second.input.dispatchEvent(new Event('input'));
  assert.equal(second.refreshed, 1);
  second.owner.abort();
});

test('boundary J needs two fresh presses and stale/pending state blocks duplicate loads', () => {
  const app = fixture();
  app.root.dispatchEvent(
    Object.assign(new Event('terminal-select'), { detail: { delta: 1, key: 'j', repeat: false } }),
  );
  assert.equal(app.loadedMore, 0);
  assert.ok(app.state.boundaryAt > 0);
  app.root.dispatchEvent(
    Object.assign(new Event('terminal-select'), { detail: { delta: 1, key: 'j', repeat: false } }),
  );
  assert.equal(app.loadedMore, 1);
  app.state.morePending = true;
  app.root.dispatchEvent(
    Object.assign(new Event('terminal-select'), { detail: { delta: 1, key: 'j', repeat: false } }),
  );
  assert.equal(app.loadedMore, 1);
  app.owner.abort();
});
