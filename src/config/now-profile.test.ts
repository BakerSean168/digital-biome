import assert from 'node:assert/strict';
import test from 'node:test';
import { NOW_ENTRIES, NOW_UPDATED_AT } from './now-profile';

test('Now is a manually updated collection of independent typed entries', () => {
  assert.match(NOW_UPDATED_AT, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(NOW_UPDATED_AT)));
  assert.equal(new Set(NOW_ENTRIES.map((entry) => entry.id)).size, NOW_ENTRIES.length);
  assert.ok(NOW_ENTRIES.length > 0);
  for (const entry of NOW_ENTRIES) {
    assert.ok(['project', 'game', 'watching'].includes(entry.kind));
    assert.match(entry.id, /^[a-z0-9-]+$/);
    assert.ok(entry.title.trim());
    assert.ok(entry.category.trim());
    assert.equal('href' in entry, false, 'Now entries should not act as cross-page links');
  }
});

test('Now item categories and statuses remain data-driven', () => {
  for (const entry of NOW_ENTRIES) {
    if (entry.kind === 'game') assert.ok(entry.category.trim(), 'A game needs a genre');
    if (entry.kind === 'watching') assert.ok(entry.status?.trim(), 'A watched item needs a status');
  }
});
