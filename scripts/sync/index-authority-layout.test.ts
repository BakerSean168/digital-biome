import assert from 'node:assert/strict';
import test from 'node:test';
import { findUpstreamNoteByLocalPath, toUpstreamSourcePath } from './reconcile-note-index';

test('canonical local note path matches the moved notes/ directory', () => {
  const upstream = new Map([
    ['notes/biomechanics-moc.md', { sourcePath: 'notes/biomechanics-moc.md', title: 'New' }],
  ]);
  assert.equal(toUpstreamSourcePath('biomechanics-moc.md'), 'notes/biomechanics-moc.md');
  assert.equal(findUpstreamNoteByLocalPath(upstream, 'biomechanics-moc.md')?.title, 'New');
  assert.equal(findUpstreamNoteByLocalPath(upstream, '.\\biomechanics-moc.md')?.title, 'New');
});

test('assets and singleton site pages never get a z/ prefix', () => {
  const upstream = new Map([
    ['assets/services/site.md', { sourcePath: 'assets/services/site.md' }],
    ['pages/about.md', { sourcePath: 'pages/about.md' }],
    ['pages/now.md', { sourcePath: 'pages/now.md' }],
  ]);
  assert.ok(findUpstreamNoteByLocalPath(upstream, 'assets/services/site.md'));
  assert.ok(findUpstreamNoteByLocalPath(upstream, 'pages/about.md'));
  assert.ok(findUpstreamNoteByLocalPath(upstream, 'pages/now.md'));
  assert.equal(findUpstreamNoteByLocalPath(upstream, 'blogs/post.md'), undefined);
  assert.equal(findUpstreamNoteByLocalPath(upstream, '../secrets.md'), undefined);
  assert.equal(findUpstreamNoteByLocalPath(upstream, 'missing.md'), undefined);
});
