import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDashboardBody } from './dashboard';

test('Dashboard derives ordered groups, ordinary links and resource references from Markdown', () => {
  const groups = parseDashboardBody(
    '# Dashboard\n> [!info] edit me\n\n## 常用\n- [ChatGPT](<https://chatgpt.com/>) · [[uses/websites/chatgpt|资源笔记]]\n### API\n- [AnyRouter](https://anyrouter.top/) — 每日签到\n## 其他\n- [A](https://example.org/)\n',
  );
  assert.deepEqual(
    groups.map(({ title, level }) => [title, level]),
    [
      ['常用', 2],
      ['API', 3],
      ['其他', 2],
    ],
  );
  assert.equal(groups[0].links[0].noteTarget, 'uses/websites/chatgpt');
  assert.equal(groups[1].links[0].description, '每日签到');
  assert.equal(groups[1].links[0].hostname, 'anyrouter.top');
  assert.equal(groups[2].links[0].href, 'https://example.org/');
});

test('Dashboard skips producer-redacted destinations and rejects unsafe or malformed entries', () => {
  assert.equal(parseDashboardBody('## A\n- [A](<private://redacted>)')[0].links.length, 0);
  for (const href of [
    'javascript:alert',
    'https://user:pass@example.com/',
    'https://example.com/?token=abc',
  ]) {
    assert.throws(() => parseDashboardBody('## A\n- [A](' + href + ')'), /unsafe URL/);
  }
  assert.throws(() => parseDashboardBody('- [A](https://example.com/)'), /invalid entry/);
});
