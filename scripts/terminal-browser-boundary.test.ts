import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = (name: string): string => fs.readFileSync(path.resolve(name), 'utf8');

test('terminal entry is a small one-time registry, not the per-browser controller', () => {
  const entry = source('src/browser/terminal-objects.ts');
  assert.match(entry, /createTerminalBrowserRegistry/);
  assert.match(entry, /mountTerminalBrowser/);
  assert.match(entry, /browsers\.reconcile/);
  assert.ok(entry.split('\n').length < 25);
  assert.doesNotMatch(entry, /addEventListener\(|new ResizeObserver\(|fetch\(/);
});

test('browser instance owns its state and terminates listeners, observers and pending work', () => {
  const controller = source('src/browser/terminal-browser-controller.ts');
  assert.match(controller, /createTerminalBrowserState/);
  assert.match(controller, /new AbortController\(/);
  assert.match(controller, /lifecycle\.abort\(/);
  assert.match(controller, /observer\.disconnect\(/);
  assert.match(controller, /resizeObserver\.disconnect\(/);
  assert.match(controller, /facets\.dispose\(/);
  assert.match(controller, /browser\.generation\+\+/);
  const loader = source('src/browser/terminal-browser-loader.ts');
  assert.match(loader, /fetch\(catalogUrl,\s*\{[\s\S]*?signal,/);
  assert.doesNotMatch(controller, /let (items|selected|filtered|generation|pending)\b/);
});

test('DOM renderer, pure URL handling and immutable public catalog remain distinct owners', () => {
  const controller = source('src/browser/terminal-browser-controller.ts');
  const dom = source('src/browser/terminal-browser-dom.ts');
  const url = source('src/browser/terminal-url.ts');
  const state = source('src/browser/terminal-browser-state.ts');
  const events = source('src/browser/terminal-browser-events.ts');
  assert.match(controller, /updatedTerminalUrl\(/);
  assert.match(controller, /initialTerminalSnapshot\(/);
  assert.match(dom, /export function paintTerminalPreview/);
  assert.match(dom, /export function materializeTerminalRows/);
  assert.match(state, /export function visibleTerminalItems/);
  assert.match(url, /URL\(locationHref\)/);
  assert.match(events, /export function bindTerminalBrowserEvents/);
  assert.match(events, /signal/);
  assert.doesNotMatch(controller, /list\.addEventListener/);
  assert.doesNotMatch(dom, /\/data\/terminal|fetch\(/);
});
