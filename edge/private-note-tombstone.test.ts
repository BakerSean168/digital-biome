import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../functions/notes/obsidian/[[path]]';

test('protected note tombstone returns a generic non-cacheable 404', async () => {
  const response = await onRequest({} as never);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Not Found');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex');
});
