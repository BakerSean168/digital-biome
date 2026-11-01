import { mountTerminalBrowser } from './terminal-browser-controller';
import { createTerminalBrowserRegistry } from './terminal-browser-registry';

const browsers = createTerminalBrowserRegistry(mountTerminalBrowser);

/** A second entry invocation reuses existing roots and cleans up replaced DOM instances. */
export function initializeObjectBrowsers(): void {
  browsers.reconcile(document.querySelectorAll<HTMLElement>('[data-object-browser]'));
  document.documentElement.dataset.browserReady = 'true';
}
