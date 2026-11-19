/** Browser tests must follow author-edited Obsidian pages, not frozen TS copy. */
import fs from 'node:fs';
import path from 'node:path';
import { ABOUT_RELATED_BLOGS, ABOUT_SECTIONS, ABOUT_UPDATED_AT } from '../src/config/about-profile';
import { NOW_ENTRIES, NOW_UPDATED_AT } from '../src/config/now-profile';
import { parseAboutBody, parseNowBody } from '../src/domain/site-pages/content';
import { publishedBlogHref } from './published-blog-href';
import { parsePublishedSitePage } from './site-page-frontmatter';

function pageSource(name: 'about' | 'now') {
  const file = path.resolve(process.cwd(), 'src', 'data', 'obsidian', 'pages', name + '.md');
  if (!fs.existsSync(file)) return undefined;
  const content = fs.readFileSync(file, 'utf8');
  return parsePublishedSitePage(content, file);
}

export const aboutSource = (() => {
  const source = pageSource('about');
  const sections = source ? parseAboutBody(source.body) : [...ABOUT_SECTIONS];
  const links = source
    ? [...source.body.matchAll(/\[\[blogs\/([a-z0-9-]+)\|([^\]]+)\]\]/g)]
        .map((x) => ({ blogSlug: x[1], phrase: x[2] }))
        .filter(({ blogSlug }) => Boolean(publishedBlogHref(blogSlug)))
    : ABOUT_RELATED_BLOGS.filter(({ blogSlug }) => Boolean(publishedBlogHref(blogSlug)));
  return {
    sections,
    updatedAt: source?.updatedAt ?? ABOUT_UPDATED_AT,
    title: source?.title ?? 'BakerSean',
    links,
    /** rendered text removes the Obsidian wikilink markup but keeps its label */
    visibleText(paragraph: string) {
      return paragraph.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
    },
  };
})();

export const nowSource = (() => {
  const source = pageSource('now');
  const entries = source ? parseNowBody(source.body) : [...NOW_ENTRIES];
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
    updatedAt: source?.updatedAt ?? NOW_UPDATED_AT,
    title: source?.title ?? '最近在做什么',
    links,
  };
})();
