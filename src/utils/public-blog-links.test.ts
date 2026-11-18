import assert from 'node:assert/strict';
import test from 'node:test';
import { ABOUT_RELATED_BLOGS, ABOUT_SECTIONS } from '../config/about-profile';
import { NOW_ENTRIES } from '../config/now-profile';
import { getPublicBlogHref, linkTextParts, renderLinkedTextHtml } from './public-blog-links';

test('related Blog phrases are present in the unchanged About copy', () => {
  for (const relation of ABOUT_RELATED_BLOGS) {
    const section = ABOUT_SECTIONS.find((item) => item.id === relation.sectionId);
    assert.ok(section, `Missing About section: ${relation.sectionId}`);
    const paragraph = section.paragraphs[relation.paragraphIndex];
    assert.ok(paragraph, `Paragraph missing for: ${relation.sectionId}`);
    assert.ok(paragraph.includes(relation.phrase), `Phrase missing: ${relation.phrase}`);
    const parts = linkTextParts(paragraph, [relation]);
    assert.equal(parts.map((part) => part.text).join(''), paragraph);
    assert.ok(!renderLinkedTextHtml(paragraph, [relation]).includes('> ' + relation.phrase + ' '));
  }
});

test('published Blog links use canonical note routes; drafts never cause dead links', () => {
  assert.equal(getPublicBlogHref('oracle-vps'), '/notes/obsidian/blogs/oracle-vps');
  assert.equal(getPublicBlogHref('invalid/path'), undefined);
  assert.deepEqual(linkTextParts('example', [{ phrase: 'example', blogSlug: 'not-a-real-blog' }]), [
    { text: 'example' },
  ]);
});

test('linked HTML escapes content safely without introducing whitespace', () => {
  assert.equal(
    renderLinkedTextHtml('a & <b> "c" \'d\'', []),
    'a &amp; &lt;b&gt; &quot;c&quot; &#39;d&#39;',
  );
  const html = renderLinkedTextHtml('prefix oracle-vps suffix', [
    { phrase: 'oracle-vps', blogSlug: 'oracle-vps' },
  ]);
  assert.match(html, /prefix <a href="\/notes\/obsidian\/blogs\/oracle-vps"/);
  assert.match(html, />oracle-vps<\/a> suffix/);
});

test('Now only provides optional Blog associations for projects', () => {
  for (const entry of NOW_ENTRIES) {
    if (entry.kind !== 'project') assert.equal(entry.blogSlug, undefined);
    if (entry.blogSlug) assert.match(entry.blogSlug, /^[a-z0-9-]+$/);
  }
});
