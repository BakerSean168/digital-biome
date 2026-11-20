/** Browser tests must follow author-edited Obsidian pages, not frozen TS copy. */
import fs from 'node:fs';
import path from 'node:path';
import { parseAboutBody, parseNowBody } from '../src/domain/site-pages/content';
import { publishedBlogHref } from './published-blog-href';
import { parseNoteWikilinks } from '../src/domain/foundation/wikilink-parser';
import { appendWikilinkAnchor } from '../src/domain/note-routing/url-builder';
import { parsePublishedSitePage } from './site-page-frontmatter';

function pageSource(name: 'about' | 'now') {
  const file = path.resolve(process.cwd(), 'src', 'data', 'obsidian', 'pages', name + '.md');
  if (!fs.existsSync(file)) throw new Error('Missing required authored page: ' + file);
  const content = fs.readFileSync(file, 'utf8');
  return parsePublishedSitePage(content, file);
}

export const aboutSource = (() => {
  const source = pageSource('about');
  const sections = parseAboutBody(source.body);
  // The public About page should link every authored target. Check the browser output
  // independently of the Astro-only static note catalog.
  const links = parseNoteWikilinks(source.body).map((link) => ({
    phrase: link.display ?? link.target,
    anchor: appendWikilinkAnchor('', link),
  }));
  return {
    sections,
    updatedAt: source.updatedAt,
    title: source.title,
    links,
    /** rendered text removes the Obsidian wikilink markup but keeps its label */
    visibleText(paragraph: string) {
      return paragraph.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
    },
  };
})();

export const nowSource = (() => {
  const source = pageSource('now');
  const entries = parseNowBody(source.body);
  const links = entries.flatMap((entry) => {
    const blogSlug =
      'linkTarget' in entry &&
      typeof entry.linkTarget === 'string' &&
      entry.linkTarget.startsWith('blogs/')
        ? entry.linkTarget.slice('blogs/'.length)
        : 'blogSlug' in entry
          ? entry.blogSlug
          : undefined;
    return blogSlug && publishedBlogHref(blogSlug) ? [{ title: entry.title, blogSlug }] : [];
  });
  return {
    entries,
    updatedAt: source.updatedAt,
    title: source.title,
    links,
  };
})();
