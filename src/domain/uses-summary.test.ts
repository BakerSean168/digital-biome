import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUsesSummaries } from './uses-summary';

const summary = { id: 'daily-keyboard', title: 'Keyboard', description: 'Writing', group: 'INPUT' };
test('summary boundary rejects private metadata, duplicate identity and link markup', () => {
  assert.deepEqual(parseUsesSummaries([summary]), [summary]);
  for (const key of ['asset_id', 'sourcePath', 'url', 'body', 'tags', 'backlinks']) {
    assert.throws(() => parseUsesSummaries([{ ...summary, [key]: 'SECRET' }]));
  }
  assert.throws(() => parseUsesSummaries([summary, summary]));
  assert.throws(() => parseUsesSummaries([{ ...summary, title: '[[private]]' }]));
  assert.throws(() => parseUsesSummaries([{ ...summary, description: 'http://internal' }]));
});
