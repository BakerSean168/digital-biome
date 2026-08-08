import { test, describe } from 'node:test';
import assert from 'node:assert';
import { formatDate, getReadingTime } from './date.ts';

describe('date utils', () => {
  describe('formatDate', () => {
    test('formats date in default locale (zh-CN)', () => {
      const date = new Date('2024-01-01T12:00:00');
      // result might vary slightly depending on environment, but usually it is "2024年1月1日"
      const result = formatDate(date);
      assert.match(result, /2024/);
      assert.match(result, /1/);
    });

    test('formats date in English locale', () => {
      const date = new Date('2024-01-01T12:00:00');
      const result = formatDate(date, 'en-US');
      assert.strictEqual(result, 'January 1, 2024');
    });

    test('handles string input', () => {
      const result = formatDate('2024-01-01', 'en-US');
      assert.strictEqual(result, 'January 1, 2024');
    });
  });

  describe('getReadingTime', () => {
    test('returns 0 for empty string', () => {
      assert.strictEqual(getReadingTime(''), 0);
    });

    test('returns 0 for whitespace only', () => {
      assert.strictEqual(getReadingTime('   '), 0);
      assert.strictEqual(getReadingTime('\n\t'), 0);
    });

    test('returns 1 for a few words', () => {
      assert.strictEqual(getReadingTime('Hello world'), 1);
      assert.strictEqual(getReadingTime('One'), 1);
    });

    test('calculates time for many words', () => {
      const words = Array(300).fill('word').join(' ');
      // 300 words / 200 words per minute = 1.5 -> ceil = 2
      assert.strictEqual(getReadingTime(words), 2);
    });

    test('calculates time for exactly the threshold', () => {
      const words = Array(200).fill('word').join(' ');
      assert.strictEqual(getReadingTime(words), 1);
    });

    test('calculates time just above the threshold', () => {
      const words = Array(201).fill('word').join(' ');
      assert.strictEqual(getReadingTime(words), 2);
    });
  });
});
