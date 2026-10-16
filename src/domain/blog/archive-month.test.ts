import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { archiveMonthTimestamp, formatArchiveMonth } from './archive-month';

describe('editorial archive month', () => {
  it('formats a month without inventing a day', () => {
    assert.equal(formatArchiveMonth('2026-04'), '专题归档 · 2026 年 4 月');
    assert.equal(formatArchiveMonth('2026-06'), '专题归档 · 2026 年 6 月');
    assert.equal(archiveMonthTimestamp('2026-04'), Date.UTC(2026, 3, 1));
    assert.ok(archiveMonthTimestamp('2026-06')! > archiveMonthTimestamp('2026-04')!);
  });

  it('rejects invalid or absent months', () => {
    for (const month of [undefined, null, '2026-4', '2026-00', '2026-13', '2026-04-01']) {
      assert.equal(archiveMonthTimestamp(month), null);
      assert.equal(formatArchiveMonth(month), undefined);
    }
  });
});
