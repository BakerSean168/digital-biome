import { createLatestRequest, type LatestRequestToken } from './latest-request';

export interface SearchIntent {
  readonly query: string;
  readonly token: LatestRequestToken;
}

export interface SearchIntentTimers {
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

export interface SearchIntentScheduler {
  schedule(query: string, callback: (intent: SearchIntent) => void): SearchIntent;
  start(query: string): SearchIntent;
  invalidate(): void;
}

export function createSearchIntentScheduler(
  delay: number,
  timers: SearchIntentTimers = {
    // Browser timer methods require their global receiver in some runtimes/bundles.
    // Wrapping them preserves the receiver instead of passing an unbound host method.
    setTimeout: (callback, timeout) => globalThis.setTimeout(callback, timeout),
    clearTimeout: handle => globalThis.clearTimeout(handle),
  },
  onIntent?: (intent: SearchIntent) => void,
): SearchIntentScheduler {
  const requests = createLatestRequest();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimer = (): void => {
    if (debounceTimer === undefined) return;
    timers.clearTimeout(debounceTimer);
    debounceTimer = undefined;
  };

  const start = (query: string): SearchIntent => {
    clearTimer();
    const intent = { query, token: requests.start() };
    onIntent?.(intent);
    return intent;
  };

  return {
    schedule(query, callback) {
      const intent = start(query);
      debounceTimer = timers.setTimeout(() => {
        debounceTimer = undefined;
        if (intent.token.isCurrent()) callback(intent);
      }, delay);
      return intent;
    },
    start,
    invalidate() {
      clearTimer();
      requests.start();
    },
  };
}
