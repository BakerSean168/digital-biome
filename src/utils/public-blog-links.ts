import { buildKnowledgeNoteHref } from '../domain/note-routing/url-builder';
import { getPublicKnowledgeNoteEntriesFromIndex } from '../repositories/knowledge-index-loader';

const publishedBlogIds = new Set(
  getPublicKnowledgeNoteEntriesFromIndex()
    .filter((entry) => entry.id.startsWith('obsidian/blogs/'))
    .map((entry) => entry.id),
);

/** A draft, private, unpublished or missing Blog must never produce a public link. */
export function getPublicBlogHref(slug: string): string | undefined {
  if (!/^[a-z0-9-]+$/.test(slug)) return undefined;
  const id = `obsidian/blogs/${slug}`;
  return publishedBlogIds.has(id) ? buildKnowledgeNoteHref(id) : undefined;
}

export interface RelatedBlogPhrase {
  phrase: string;
  blogSlug: string;
}

export interface LinkedTextPart {
  text: string;
  href?: string;
}

/** Preserve the original paragraph verbatim; only add anchors for published Blogs. */
export function linkTextParts(
  paragraph: string,
  relations: readonly RelatedBlogPhrase[],
): LinkedTextPart[] {
  const matches = relations
    .map(({ phrase, blogSlug }) => ({
      phrase,
      position: paragraph.indexOf(phrase),
      href: getPublicBlogHref(blogSlug),
    }))
    .filter((match) => match.position >= 0 && match.href)
    .sort((a, b) => a.position - b.position);

  const parts: LinkedTextPart[] = [];
  let cursor = 0;
  for (const { phrase, position, href } of matches) {
    if (position < cursor) continue;
    if (position > cursor) parts.push({ text: paragraph.slice(cursor, position) });
    parts.push({ text: phrase, href });
    cursor = position + phrase.length;
  }
  if (cursor < paragraph.length) parts.push({ text: paragraph.slice(cursor) });
  return parts.length > 0 ? parts : [{ text: paragraph }];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Astro formatting can add spaces between JSX fragments. Render precisely
 * adjacent text and links, escaping both content and attributes first.
 */
export function renderLinkedTextHtml(
  paragraph: string,
  relations: readonly RelatedBlogPhrase[],
): string {
  return linkTextParts(paragraph, relations)
    .map((part) => {
      const text = escapeHtml(part.text);
      if (!part.href) return text;
      return `<a href="${escapeHtml(part.href)}" class="text-primary underline decoration-primary/50 underline-offset-4 hover:text-primary-hover">${text}</a>`;
    })
    .join('');
}
