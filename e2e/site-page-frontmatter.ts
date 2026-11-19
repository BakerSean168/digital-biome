import { frontmatterString, parseMarkdownFrontmatter } from '../src/domain/markdown/frontmatter';

export interface SitePageSource {
  title: string;
  updatedAt: string;
  body: string;
}

/**
 * The public producer serializes YAML timestamps as either ISO strings or a
 * quoted JavaScript Date string with an explicit timezone. Read the published
 * Markdown with the same YAML adapter as the site rather than assuming the
 * original Vault frontmatter is preserved byte-for-byte.
 */
export function parsePublishedSitePage(markdown: string, sourceLabel: string): SitePageSource {
  const parsed = parseMarkdownFrontmatter(markdown, sourceLabel);
  if (!parsed.hasFrontmatter) {
    throw new Error('Missing Obsidian site-page frontmatter: ' + sourceLabel);
  }

  const title = frontmatterString(parsed.data.title);
  if (!title) throw new Error('Missing title in Obsidian site page: ' + sourceLabel);

  const updated = frontmatterString(parsed.data.updated);
  const date = updated ? new Date(updated) : undefined;
  if (!date || !Number.isFinite(date.getTime())) {
    throw new Error('Missing or invalid updated timestamp: ' + sourceLabel);
  }

  return {
    title,
    updatedAt: date.toISOString().slice(0, 10),
    body: parsed.body,
  };
}
