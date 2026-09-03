import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  rewriteImagePaths,
  rewriteVaultNoteLinks,
  quoteYamlSpecialValues,
  detectYamlRisks,
  normalizeFrontmatterIndentation,
  processContent,
} from './markdown-transform';

describe('rewriteImagePaths', () => {
  test('rewrites Obsidian wikilink images to vault assets', () => {
    assert.equal(rewriteImagePaths('![[image.png]]', '/vault-assets'), '![image](/vault-assets/image.png)');
    assert.equal(
      rewriteImagePaths('![[assets/img/photo 1.png]]', '/vault-assets'),
      '![photo 1](/vault-assets/photo%201.png)',
    );
  });

  test('rewrites local markdown images and preserves remote ones', () => {
    assert.equal(
      rewriteImagePaths('![alt](assets/img/photo.png)', '/vault-assets'),
      '![alt](/vault-assets/photo.png)',
    );
    assert.equal(
      rewriteImagePaths('![alt](assets/photo%201.png)', '/vault-assets'),
      '![alt](/vault-assets/photo%201.png)',
    );
    assert.equal(
      rewriteImagePaths('![alt](https://example.com/photo.png)', '/vault-assets'),
      '![alt](https://example.com/photo.png)',
    );
  });

  test('leaves local non-image files untouched', () => {
    assert.equal(rewriteImagePaths('![alt](guide.txt)', '/vault-assets'), '![alt](guide.txt)');
  });
});

describe('rewriteVaultNoteLinks', () => {
  test('rewrites vault-relative note links to public URLs', () => {
    assert.equal(
      rewriteVaultNoteLinks('[Note](/thought-forest/z/tech/frontend/vue.md)'),
      '[Note](/notes/obsidian/tech/frontend/vue)',
    );
  });

  test('rewrites backslash paths and leaves foreign links alone', () => {
    assert.equal(
      rewriteVaultNoteLinks('[Note](thought-forest\\z\\n.md)'),
      '[Note](/notes/obsidian/n)',
    );
    assert.equal(rewriteVaultNoteLinks('[Other](other.md)'), '[Other](other.md)');
    assert.equal(
      rewriteVaultNoteLinks('[Web](https://example.com/a.md)'),
      '[Web](https://example.com/a.md)',
    );
  });
});

describe('quoteYamlSpecialValues', () => {
  test('quotes values that start with YAML special characters', () => {
    assert.equal(quoteYamlSpecialValues('key: @value'), 'key: "@value"');
    assert.equal(quoteYamlSpecialValues('key: `value`'), 'key: "`value`"');
    assert.equal(quoteYamlSpecialValues('key: :value'), 'key: ":value"');
  });

  test('leaves already quoted values alone', () => {
    assert.equal(quoteYamlSpecialValues('key: "@value"'), 'key: "@value"');
    assert.equal(quoteYamlSpecialValues('title: plain'), 'title: plain');
  });

  test('escapes quotes and backslashes inside the quoted value', () => {
    assert.equal(quoteYamlSpecialValues('key: @va"lue'), 'key: "@va\\"lue"');
  });
});

describe('detectYamlRisks', () => {
  test('reports unquoted special values and skips quoted ones', () => {
    const warnings = detectYamlRisks('title: ok\nkey: @v\nq: `x`\nquoted: "@y"', 'file.md');
    assert.deepEqual(warnings, [
      'file.md: field "key" starts with special YAML character — may cause parse failures in consumers',
      'file.md: field "q" starts with special YAML character — may cause parse failures in consumers',
    ]);
  });
});

describe('normalizeFrontmatterIndentation', () => {
  test('strips a common leading indent', () => {
    assert.equal(normalizeFrontmatterIndentation('  a: 1\n  b: 2'), 'a: 1\nb: 2');
  });

  test('keeps content with zero indentation', () => {
    assert.equal(normalizeFrontmatterIndentation('a: 1\n  b: 2'), 'a: 1\n  b: 2');
  });
});

describe('processContent', () => {
  test('adds minimal frontmatter when none exists', () => {
    assert.equal(
      processContent('Hello world', 'my-note.md', '/vault-assets'),
      '---\ntitle: "my-note"\ntags: []\n---\n\nHello world',
    );
  });

  test('injects a title into frontmatter missing one', () => {
    assert.equal(
      processContent('---\ntags: [tech]\n---\n\nBody', 'my-note.md', '/vault-assets'),
      '---\ntitle: "my-note"\ntags: [tech]\n---\n\nBody',
    );
  });

  test('keeps an existing title and body intact', () => {
    assert.equal(
      processContent('---\ntitle: "Real Title"\n---\n\nBody', 'my-note.md', '/vault-assets'),
      '---\ntitle: "Real Title"\n---\n\nBody',
    );
  });

  test('redacts network identifiers when requested', () => {
    const output = processContent('HostName 192.0.2.9', 'n.md', '/vault-assets', {
      redactNetworkIdentifiers: true,
    });
    assert.match(output, /HostName 192\.0\.x\.x/);
  });

  test('does not redact by default', () => {
    const output = processContent('HostName 192.0.2.9', 'n.md', '/vault-assets');
    assert.match(output, /HostName 192\.0\.2\.9/);
  });

  test('redacts protected infrastructure URLs when configured', () => {
    const internalUrl = 'https://internal.example.test:8443';
    const output = processContent(`[Admin](${internalUrl})`, 'n.md', '/vault-assets', {
      protectedInfrastructureUrls: new Set([internalUrl]),
    });
    assert.match(output, /\[Admin\]\(private:\/\/redacted\)/);
  });
});
