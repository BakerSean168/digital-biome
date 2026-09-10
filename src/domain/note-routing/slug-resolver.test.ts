import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildSlugMap, resolveWikilinkTarget } from './slug-resolver';

interface NoteFixture {
  id: string;
  data: {
    title?: string | null;
    aliases?: string[] | null;
    draft?: boolean | null;
    private?: boolean | null;
    visibility?: string | null;
    asset_id?: string | null;
    asset_type?: 'service' | 'tool' | 'host' | 'network' | 'subscription' | 'project' | null;
  };
}

function note(id: string, data: NoteFixture['data'] = {}): NoteFixture {
  return { id, data };
}

function resolve(target: string, entries: NoteFixture[]) {
  return resolveWikilinkTarget(target, buildSlugMap(entries), entries);
}

describe('resolveWikilinkTarget', () => {
  test('resolves by exact note id', () => {
    const entries = [note('obsidian/vue-computed', { title: 'Vue Computed' })];
    assert.deepEqual(resolve('obsidian/vue-computed', entries), {
      status: 'resolved',
      noteId: 'obsidian/vue-computed',
      href: '/notes/obsidian/vue-computed',
    });
  });

  test('resolves by title, alias, and relative id case-insensitively', () => {
    const entries = [
      note('obsidian/life/reading', { title: '阅读', aliases: ['Reading', 'book'] }),
    ];
    assert.equal(resolve('vue', [note('obsidian/vue-computed', { title: 'Vue' })])!.status, 'resolved');
    assert.equal(resolve('阅读', entries).status, 'resolved');
    assert.equal(resolve('BOOK', entries).status, 'resolved');
    assert.equal(resolve('life/reading', entries).status, 'resolved');
  });

  test('trims whitespace around targets', () => {
    const entries = [note('obsidian/vue-computed', { title: 'Vue Computed' })];
    assert.equal(resolve('  VUE COMPUTED  ', entries).status, 'resolved');
  });

  test('reports ambiguous matches with all public candidate ids', () => {
    const entries = [
      note('obsidian/note-a', { title: '同题' }),
      note('obsidian/note-b', { title: '同题' }),
    ];
    assert.deepEqual(resolve('同题', entries), {
      status: 'ambiguous',
      candidates: ['obsidian/note-a', 'obsidian/note-b'],
    });
  });

  test('never resolves a link to a private note', () => {
    const entries = [note('obsidian/draft', { draft: true, title: 'secret' })];
    assert.deepEqual(resolve('secret', entries), {
      status: 'private',
      noteId: 'obsidian/draft',
    });
  });

  test('prefers the public candidate when a key matches private and public notes', () => {
    const entries = [
      note('obsidian/draft', { private: true, title: 'shared' }),
      note('obsidian/public', { title: 'shared' }),
    ];
    assert.deepEqual(resolve('shared', entries), {
      status: 'resolved',
      noteId: 'obsidian/public',
      href: '/notes/obsidian/public',
    });
  });

  test('reports multiple private matches as ambiguous without leaking hrefs', () => {
    const entries = [
      note('obsidian/priv-a', { visibility: 'private', title: 'locked' }),
      note('obsidian/priv-b', { visibility: 'private', title: 'locked' }),
    ];
    assert.deepEqual(resolve('locked', entries), {
      status: 'ambiguous',
      candidates: ['obsidian/priv-a', 'obsidian/priv-b'],
    });
  });

  test('routes asset notes to their asset page', () => {
    const entries = [
      note('obsidian/assets/services/home', {
        title: 'Home Dashboard',
        asset_id: 'svc-home',
        asset_type: 'service',
      }),
    ];
    assert.deepEqual(resolve('Home Dashboard', entries), {
      status: 'asset',
      noteId: 'obsidian/assets/services/home',
      href: '/services/svc-home',
    });
  });

  test('assets without a usable asset type degrade to the knowledge note href', () => {
    const entries = [note('obsidian/assets/x', { title: 'Odd', asset_id: 'odd' })];
    assert.deepEqual(resolve('Odd', entries), {
      status: 'resolved',
      noteId: 'obsidian/assets/x',
      href: '/notes/obsidian/assets/x',
    });
  });

  test('falls back to an endsWith match on note ids', () => {
    const entries = [note('obsidian/tech/frontend/vue', { title: 'Vue Guide' })];
    assert.deepEqual(resolve('frontend/vue', entries), {
      status: 'resolved',
      noteId: 'obsidian/tech/frontend/vue',
      href: '/notes/obsidian/tech/frontend/vue',
    });
  });

  test('endsWith fallback requires a path segment boundary', () => {
    const entries = [note('obsidian/typescript', { title: 'TS' })];
    assert.equal(resolve('script', entries).status, 'missing');
    assert.equal(resolve('typescript', entries).status, 'resolved');
  });

  test('endsWith fallback honors private notes', () => {
    const entries = [note('obsidian/tech/draft-idea', { draft: true })];
    assert.equal(resolve('draft-idea', entries).status, 'private');
  });

  test('endsWith fallback reports ambiguous matches', () => {
    const entries = [
      note('obsidian/tech/a/guide', {}),
      note('obsidian/dev/a/guide', {}),
    ];
    assert.deepEqual(resolve('a/guide', entries), {
      status: 'ambiguous',
      candidates: ['obsidian/tech/a/guide', 'obsidian/dev/a/guide'],
    });
  });

  test('returns missing for unknown or empty targets', () => {
    const entries = [note('obsidian/vue-computed', { title: 'Vue' })];
    assert.equal(resolve('does-not-exist', entries).status, 'missing');
    assert.equal(resolve('', entries).status, 'missing');
  });
});
