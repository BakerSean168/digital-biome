import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('MemoFlow renames preserve old public note URLs', () => {
  const redirects = new Map(
    readFileSync('public/_redirects', 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const [from, to, code] = line.split(/\s+/);
        return [from, { to, code }] as const;
      }),
  );
  for (const [oldPath, newPath] of [
    ['/notes/obsidian/daily-use-moc', '/notes/obsidian/memoflow-early-development-moc'],
    [
      '/notes/obsidian/blogs/ui-refactor-for-dailyuse-memoflow',
      '/notes/obsidian/blogs/memoflow-ai-prototype-design',
    ],
  ]) {
    for (const trailingSlash of ['', '/']) {
      assert.deepEqual(redirects.get(oldPath + trailingSlash), {
        to: newPath + trailingSlash,
        code: '301',
      });
    }
  }
});
