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

test('browser history validates sorting and a stable scroll anchor while accepting old entries', () => {
  const snapshot = {
    query: 'linux',
    facets: [],
    limit: 40,
    sort: 'title',
    anchor: { id: 'linux-do', offset: -8 },
  };
  assert.deepEqual(readBrowserSnapshot({ biomeBrowsers: { tools: snapshot } }, 'tools'), snapshot);
  for (const extra of [
    { sort: 'random' },
    { anchor: { id: 'linux-do', offset: Infinity } },
    { anchor: { id: 1, offset: 0 } },
    { anchor: { id: 'linux-do', offset: '12' } },
  ]) {
    assert.equal(
      readBrowserSnapshot({ biomeBrowsers: { tools: { ...snapshot, ...extra } } }, 'tools'),
      undefined,
    );
  }
});
