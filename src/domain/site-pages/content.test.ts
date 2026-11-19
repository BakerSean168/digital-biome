import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseAboutBody, parseNowBody, renderAboutParagraphHtml } from './content';

test('About markdown uses stable heading anchors regardless of order or copy edits', () => {
  const sections = parseAboutBody(
    [
      '## 新的想法',
      '^about-ideas',
      '',
      '一段话，[[blogs/meaning-of-life|关于人生]]。',
      '',
      '第二段。',
      '',
      '## 对计算机相关的事物有兴趣',
      '^about-practice',
      '',
      '一段关于电脑的话。',
    ].join('\n'),
  );
  assert.deepEqual(
    sections.map(({ id, anchor }) => [id, anchor]),
    [
      ['nihilism', 'about-ideas'],
      ['computers', 'about-practice'],
    ],
  );
  assert.equal(sections[0].paragraphs.length, 2);
  assert.match(sections[0].paragraphs[0], /\[\[blogs\/meaning-of-life/);
});

test('About rejects missing, duplicate and misplaced stable block ids', () => {
  assert.throws(() => parseAboutBody('## test\n\nbody'), /block ref/);
  assert.throws(
    () => parseAboutBody('## A\n^about-ideas\n\nA\n\n## B\n^about-ideas\n\nB'),
    /duplicate/,
  );
  assert.throws(() => parseAboutBody('## A\n\nA\n^about-ideas'), /directly follow/);
});

test('Now items preserve id, category, linked title, secondary language and order', () => {
  const entries = parseNowBody(
    [
      '## 正在开发',
      '',
      '- [[blogs/memoflow|MemoFlow]] — 工作中。 ^memoflow',
      '',
      '## 正在玩',
      '- 英雄联盟（League of Legends） — 最近玩。 ^league-of-legends',
      '',
      '## 正在看',
      '- 绝命毒师（Breaking Bad） — 已看。 ^breaking-bad',
    ].join('\n'),
  );
  assert.deepEqual(
    entries.map((x) => x.id),
    ['memoflow', 'league-of-legends', 'breaking-bad'],
  );
  assert.deepEqual(
    entries.map((x) => x.kind),
    ['project', 'game', 'watching'],
  );
  assert.equal(entries[0].linkTarget, 'blogs/memoflow');
  assert.equal(entries[1].secondaryName, 'League of Legends');
  assert.equal(entries[2].title, '绝命毒师');
});

test('Now rejects malformed records and duplicate ids', () => {
  assert.throws(() => parseNowBody('## 未知\n- X — Y ^x'), /unknown category/);
  assert.throws(() => parseNowBody('## 正在玩\n- X — Y'), /stable-id/);
  assert.throws(() => parseNowBody('## 正在玩\n- X — Y ^x\n- Z — Y ^x'), /duplicate item id/);
});

test('WikiLink renderer escapes untrusted text and accepts only public hrefs', () => {
  const raw = '<script>alert(1)</script> [[blogs/public|公开文章]] 以及 [[blogs/private|私密文章]]';
  const html = renderAboutParagraphHtml(raw, (target) =>
    target === 'blogs/public' ? '/notes/obsidian/blogs/public' : undefined,
  );
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<a href="/notes/obsidian/blogs/public"'));
  assert.ok(html.includes('私密文章'));
  assert.ok(!html.includes('blogs/private'));
});
