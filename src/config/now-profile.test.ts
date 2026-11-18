import assert from 'node:assert/strict';
import test from 'node:test';
import { NOW_ENTRIES, NOW_UPDATED_AT } from './now-profile';

test('Now snapshot date is an explicit valid date', () => {
  assert.match(NOW_UPDATED_AT, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(NOW_UPDATED_AT)));
});

test('Now is a set of independent typed records with an icon, name and short description', () => {
  assert.equal(new Set(NOW_ENTRIES.map((entry) => entry.id)).size, NOW_ENTRIES.length);
  assert.ok(NOW_ENTRIES.length > 0);
  const allowedKinds = new Set(['project', 'game', 'watching']);
  for (const entry of NOW_ENTRIES) {
    assert.ok(allowedKinds.has(entry.kind));
    assert.match(entry.id, /^[a-z0-9-]+$/);
    assert.ok(entry.title.trim());
    assert.ok(entry.description.trim());
    assert.ok(entry.description.length < 90);
    assert.ok(!('href' in entry), 'Now entries should not introduce cross-page links');
    assert.ok(!('category' in entry), 'Category is communicated by the icon');
    assert.ok(!('status' in entry), 'No separate status badges');
  }
});

test('BodySense is correctly identified as a project', () => {
  assert.equal(NOW_ENTRIES.find((entry) => entry.id === 'bodysense')?.title, 'BodySense');
  assert.ok(
    !NOW_ENTRIES.some((entry) => entry.id === 'ali-three' || entry.title.includes('阿里三')),
  );
});
