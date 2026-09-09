import assert from 'node:assert/strict';
import test from 'node:test';
import { createSearchIntentScheduler, type SearchIntent, type SearchIntentTimers } from './search-intent';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(value => {
    resolve = value;
  });
  return { promise, resolve };
}

function fakeTimers(): {
  timers: SearchIntentTimers;
  runNext: () => void;
} {
  const pending = new Map<number, () => void>();
  let nextId = 0;
  return {
    timers: {
      setTimeout(callback) {
        const id = nextId++;
        pending.set(id, callback);
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout(handle) {
        pending.delete(handle as unknown as number);
      },
    },
    runNext() {
      const next = pending.entries().next();
      if (next.done) throw new Error('No pending timer.');
      pending.delete(next.value[0]);
      next.value[1]();
    },
  };
}

test('invalidates stale search work when a new intent is typed during debounce', async () => {
  const timers = fakeTimers();
  const first = deferred<string>();
  const second = deferred<string>();
  const rendered: string[] = [];
  let loading = false;
  let pendingIntent = false;
  let selected: string | null = 'old result';
  let status = 'old status';
  let executions = 0;
  const scheduler = createSearchIntentScheduler(200, timers.timers, () => {
    pendingIntent = true;
    loading = false;
    selected = null;
    status = 'pending';
    rendered.length = 0;
  });
  const run = async (intent: SearchIntent): Promise<void> => {
    loading = true;
    const value = await (intent.query === 'A' ? first.promise : second.promise);
    if (!intent.token.isCurrent()) return;
    rendered.push(value);
    loading = false;
    pendingIntent = false;
    selected = value;
    status = value;
  };

  const executeSelected = (): void => {
    if (!pendingIntent && selected) executions += 1;
  };

  scheduler.schedule('A', intent => void run(intent));
  timers.runNext();
  scheduler.schedule('B', intent => void run(intent));
  first.resolve('A result');
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(rendered, []);
  assert.equal(loading, false);
  assert.equal(pendingIntent, true);
  assert.equal(selected, null);
  assert.equal(pendingIntent ? null : selected, null);
  assert.equal(status, 'pending');
  executeSelected();
  assert.equal(executions, 0);

  timers.runNext();
  second.resolve('B result');
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(rendered, ['B result']);
  assert.equal(pendingIntent, false);
  assert.equal(selected, 'B result');
  assert.equal(status, 'B result');
  executeSelected();
  assert.equal(executions, 1);
});

test('modal close invalidates an active and debounced search', async () => {
  const timers = fakeTimers();
  const active = deferred<string>();
  const rendered: string[] = [];
  const scheduler = createSearchIntentScheduler(200, timers.timers);
  scheduler.schedule('A', async intent => {
    const value = await active.promise;
    if (intent.token.isCurrent()) rendered.push(value);
  });
  timers.runNext();
  scheduler.schedule('B', () => {
    rendered.push('B');
  });
  scheduler.invalidate();
  active.resolve('A');
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(rendered, []);
  assert.throws(() => timers.runNext(), /No pending timer/);
});
