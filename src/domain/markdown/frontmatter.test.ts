import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frontmatterNumber,
  frontmatterBoolean,
  frontmatterRecord,
  frontmatterRecordArray,
  frontmatterString,
  frontmatterStringArray,
  parseMarkdownFrontmatter,
} from './frontmatter';

test('parses full YAML frontmatter including block scalars, arrays, and nested objects', () => {
  const parsed = parseMarkdownFrontmatter(
    `---\ntitle: "A: quoted title"\ndescription: >-\n  first line\n  second line\ntags: [typescript, "react, ts"]\naliases:\n  - "A, B"\n  - C\ndraft: true\nmonitor:\n  provider: nezha\nlinks:\n  - label: docs\n    url: /docs\n---\nbody`,
    'fixture.md',
  );

  assert.equal(frontmatterString(parsed.data.title), 'A: quoted title');
  assert.equal(frontmatterString(parsed.data.description), 'first line second line');
  assert.deepEqual(frontmatterStringArray(parsed.data.tags), ['typescript', 'react, ts']);
  assert.deepEqual(frontmatterStringArray(parsed.data.aliases), ['A, B', 'C']);
  assert.equal(frontmatterBoolean(parsed.data.draft), true);
  assert.deepEqual(frontmatterRecord(parsed.data.monitor), { provider: 'nezha' });
  assert.deepEqual(frontmatterRecordArray(parsed.data.links), [{ label: 'docs', url: '/docs' }]);
  assert.equal(parsed.body, 'body');
});

test('fails closed on malformed YAML instead of silently projecting partial metadata', () => {
  assert.throws(
    () => parseMarkdownFrontmatter('---\ntags: [a, b\n---\nbody', 'broken.md'),
    /Invalid YAML frontmatter in broken\.md/,
  );
});

test('treats Markdown without frontmatter as an empty projection', () => {
  const parsed = parseMarkdownFrontmatter('# heading\nbody');
  assert.equal(parsed.hasFrontmatter, false);
  assert.deepEqual(parsed.data, {});
  assert.equal(parsed.body, '# heading\nbody');
});

test('projects finite numeric scalars without coercing empty values', () => {
  assert.equal(frontmatterNumber(12.5), 12.5);
  assert.equal(frontmatterNumber('0.65'), 0.65);
  assert.equal(frontmatterNumber(''), undefined);
  assert.equal(frontmatterNumber('not-a-number'), undefined);
});
