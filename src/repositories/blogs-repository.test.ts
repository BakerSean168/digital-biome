import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NoteIndexEntry } from '../types/knowledge-index';
import { sortBlogPosts } from './blogs-repository';

function blog(id: string, archiveMonth?: string, updated = '2026-10-16T16:07:00+08:00') {
  return { id, archiveMonth, updated, created: updated } as NoteIndexEntry;
}

test('blog archive months take precedence over metadata edits in display order', () => {
  const posts = [
    blog('april', '2026-04'),
    blog('june-b', '2026-06'),
    blog('legacy', undefined, '2026-07-20T12:00:00+08:00'),
    blog('may', '2026-05'),
    blog('june-a', '2026-06'),
  ];
  assert.deepEqual(
    sortBlogPosts(posts).map((post) => post.id),
    ['legacy', 'june-a', 'june-b', 'may', 'april'],
  );
  assert.equal(posts[0].id, 'april', 'sorting must not modify its input');
});

test('blog sorting falls back to actual edited date when no archive month is set', () => {
  const posts = [blog('earlier', undefined, '2026-08-01'), blog('later', undefined, '2026-09-02')];
  assert.deepEqual(
    sortBlogPosts(posts).map((post) => post.id),
    ['later', 'earlier'],
  );
});
