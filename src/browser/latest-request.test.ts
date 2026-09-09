import assert from 'node:assert/strict';
import test from 'node:test';
import { createLatestRequest } from './latest-request';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(value => {
    resolve = value;
  });
  return { promise, resolve };
}

async function commitLatest<T>(
  controller: ReturnType<typeof createLatestRequest>,
  operation: Promise<T>,
  commit: (value: T) => void,
): Promise<void> {
  const request = controller.start();
  const value = await operation;
  if (request.isCurrent()) commit(value);
}

test('Discover commits only the latest search when the first resolves last', async () => {
  const controller = createLatestRequest();
  const first = deferred<string>();
  const second = deferred<string>();
  const committed: string[] = [];
  const firstSearch = commitLatest(controller, first.promise, value => committed.push(value));
  const secondSearch = commitLatest(controller, second.promise, value => committed.push(value));

  second.resolve('second');
  await secondSearch;
  first.resolve('first');
  await firstSearch;

  assert.deepEqual(committed, ['second']);
});

test('SiteSearch keeps loading and selection commits owned by the latest request', async () => {
  const controller = createLatestRequest();
  const first = deferred<{ query: string; selectedIndex: number }>();
  const second = deferred<{ query: string; selectedIndex: number }>();
  const committed: Array<{ query: string; selectedIndex: number }> = [];
  const firstSearch = commitLatest(controller, first.promise, value => committed.push(value));
  const secondSearch = commitLatest(controller, second.promise, value => committed.push(value));

  second.resolve({ query: 'second', selectedIndex: 0 });
  await secondSearch;
  first.resolve({ query: 'first', selectedIndex: 3 });
  await firstSearch;

  assert.deepEqual(committed, [{ query: 'second', selectedIndex: 0 }]);
});
