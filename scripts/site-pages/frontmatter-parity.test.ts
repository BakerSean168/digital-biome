import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePublishedSitePage } from '../../e2e/site-page-frontmatter';

test('page metadata accepts an explicit UTC ISO timestamp', () => {
  const page = parsePublishedSitePage(
    '---\ntitle: About\nupdated: 2026-11-18T00:00:00Z\n---\n\n## Essay',
    'pages/about.md',
  );
  assert.equal(page.title, 'About');
  assert.equal(page.updatedAt, '2026-11-18');
  assert.equal(page.body.trim(), '## Essay');
});

test('page metadata accepts a timezone-aware Date string from the public projection', () => {
  const page = parsePublishedSitePage(
    '---\ntitle: "BakerSean"\nupdated: "Wed Nov 18 2026 08:00:00 GMT+0800 (China Standard Time)"\n---\n## Essay',
    'pages/about.md',
  );
  assert.equal(page.title, 'BakerSean');
  assert.equal(page.updatedAt, '2026-11-18');
});

test('page metadata rejects missing or invalid dates rather than guessing', () => {
  assert.throws(
    () => parsePublishedSitePage('---\ntitle: About\n---\nBody', 'pages/about.md'),
    /Missing or invalid updated timestamp/,
  );
  assert.throws(
    () =>
      parsePublishedSitePage(
        '---\ntitle: About\nupdated: "not-a-date"\n---\nBody',
        'pages/about.md',
      ),
    /Missing or invalid updated timestamp/,
  );
  assert.throws(
    () => parsePublishedSitePage('Body only', 'pages/about.md'),
    /Missing Obsidian site-page frontmatter/,
  );
});
