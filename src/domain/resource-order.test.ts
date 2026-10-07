import assert from 'node:assert/strict';
import test from 'node:test';
import { compareResourcePriority, parseUsagePriority } from './resource-order';

test('resource priority sorts 1/1/2/unset with numeric titles and stable identity ties', () => {
  const items = [
    { id: 'unset', title: 'A' },
    { id: 'second', title: 'A', usagePriority: 2 },
    { id: 'b', title: 'Tool 10', usagePriority: 1 },
    { id: 'a', title: 'Tool 2', usagePriority: 1 },
    { id: 'c', title: 'Tool 2', usagePriority: 1 },
  ];
  assert.deepEqual(
    items.sort(compareResourcePriority).map((item) => item.id),
    ['a', 'c', 'b', 'second', 'unset'],
  );
  assert.equal(parseUsagePriority(null), undefined);
  assert.equal(parseUsagePriority(undefined), undefined);
  assert.equal(parseUsagePriority(1), 1);
  for (const value of [0, -1, 0.5, '1', true, Infinity, NaN]) {
    assert.throws(() => parseUsagePriority(value), /positive integer/);
  }
});
