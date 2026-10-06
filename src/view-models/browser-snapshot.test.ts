import assert from 'node:assert/strict';
import test from 'node:test';
import { readBrowserSnapshot, withBrowserSnapshot } from './browser-snapshot';

test('independent category state survives writes without replacing router-owned history', () => {
  const services = { query: 'model', facets: ['access'], selectedId: 'litellm', limit: 24 };
  const hosts = { query: '', facets: [], selectedId: 'oracle', limit: 12 };
  const state = withBrowserSnapshot(
    withBrowserSnapshot({ router: 1 }, '/tools#services', services),
    '/tools#hosts',
    hosts,
  );
  assert.equal(state.router, 1);
  assert.deepEqual(readBrowserSnapshot(state, '/tools#services'), services);
  assert.deepEqual(readBrowserSnapshot(state, '/tools#hosts'), hosts);
  assert.equal(readBrowserSnapshot(state, '/notes'), undefined);
});

test('untrusted or stale history cannot supply invalid browser state', () => {
  for (const value of [
    null,
    {},
    { query: '', facets: [], limit: -1 },
    { query: '', facets: [12], limit: 12 },
    { query: '', facets: [], limit: Infinity },
  ]) {
    assert.equal(readBrowserSnapshot({ biomeBrowsers: { notes: value } }, 'notes'), undefined);
  }
});
