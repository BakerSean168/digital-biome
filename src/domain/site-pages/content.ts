/**
 * Obsidian-native convention for public singleton pages.
 *
 * pages/about.md: h2, stable block ref (^about-id), paragraphs
 * pages/now.md:   known h2 groups and list items ending with ^stable-id
 *
 * The grammar is intentionally small: malformed content fails the build instead
 * of silently changing the page or inadvertently publishing private markup.
 */
import { parseNoteWikilinks } from '../foundation/wikilink-parser';
import { appendWikilinkAnchor } from '../note-routing/url-builder';

export interface AboutSection {
  id: string;
  anchor: string;
  title: string;
  paragraphs: string[];
}

export type NowKind = 'project' | 'game' | 'watching';
export interface NowPageEntry {
  id: string;
  kind: NowKind;
  title: string;
  description: string;
  secondaryName?: string;
  linkTarget?: string;
  blogSlug?: string;
}

const originalAboutIds: Record<string, string> = {
  'about-practice': 'computers',
  'about-knowledge': 'knowledge',
  'about-interests': 'games',
  'about-ideas': 'nihilism',
  'about-lifestyle': 'simplicity',
  'about-content': 'rehabilitation',
};

function linesOf(body: string): string[] {
  return body.replace(/\r\n/g, '\n').trim().split('\n');
}

export function parseAboutBody(body: string): AboutSection[] {
  const result: AboutSection[] = [];
  let current: AboutSection | undefined;
  let paragraph: string[] = [];
  const seen = new Set<string>();
  const flush = () => {
    if (current && paragraph.length) current.paragraphs.push(paragraph.join(' '));
    paragraph = [];
  };
  const finish = () => {
    flush();
    if (!current) return;
    if (!current.anchor || !current.paragraphs.length) {
      throw new Error('pages/about.md: every h2 needs a ^about-* block ref and body paragraphs');
    }
    result.push(current);
  };

  for (const line of linesOf(body)) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      finish();
      current = { id: '', anchor: '', title: heading[1].trim(), paragraphs: [] };
      if (!current.title) throw new Error('pages/about.md: empty heading');
      continue;
    }
    const anchor = /^\^(about-[a-z0-9-]+)$/.exec(line);
    if (anchor) {
      if (!current || current.anchor || current.paragraphs.length || paragraph.length) {
        throw new Error('pages/about.md: ^about-* must directly follow a heading');
      }
      if (seen.has(anchor[1])) throw new Error('pages/about.md: duplicate anchor ' + anchor[1]);
      seen.add(anchor[1]);
      current.anchor = anchor[1];
      current.id = originalAboutIds[current.anchor] ?? current.anchor.slice('about-'.length);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (!current || /^(?:#|[-*] |>|<)/.test(line)) {
      throw new Error('pages/about.md: unsupported Markdown outside h2/paragraphs');
    }
    paragraph.push(line);
  }
  finish();
  if (!result.length) throw new Error('pages/about.md: no sections');
  return result;
}

const kinds: Record<string, NowKind> = {
  正在开发: 'project',
  正在玩: 'game',
  正在看: 'watching',
};

export function parseNowBody(body: string): NowPageEntry[] {
  const result: NowPageEntry[] = [];
  const seen = new Set<string>();
  let kind: NowKind | undefined;
  for (const line of linesOf(body)) {
    if (!line.trim()) continue;
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      kind = kinds[heading[1].trim()];
      if (!kind) throw new Error('pages/now.md: unknown category ' + heading[1]);
      continue;
    }
    const item = /^- (.+?) — (.+?) \^([a-z0-9-]+)$/.exec(line);
    if (!item || !kind)
      throw new Error('pages/now.md: expected a categorized list item with ^stable-id: ' + line);
    const [, rawTitle, description, id] = item;
    if (seen.has(id)) throw new Error('pages/now.md: duplicate item id ' + id);
    seen.add(id);
    const linked = /^\[\[([^|\]]+)\|([^\]]+)\]\](?:（([^）]+)）)?$/.exec(rawTitle);
    const plain = /^(.+?)(?:（([^）]+)）)?$/.exec(rawTitle);
    if (!linked && !plain) throw new Error('pages/now.md: invalid item title');
    const secondaryName = (linked?.[3] ?? plain?.[2])?.trim();
    result.push({
      id,
      kind,
      title: (linked?.[2] ?? plain?.[1] ?? '').trim(),
      description: description.trim(),
      ...(secondaryName ? { secondaryName } : {}),
      ...(linked ? { linkTarget: linked[1] } : {}),
    });
  }
  if (!result.length) throw new Error('pages/now.md: no items');
  return result;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Resolve links only through the public note catalog; unavailable targets stay plain. */
export function renderAboutParagraphHtml(
  text: string,
  resolveHref: (target: string) => string | undefined,
): string {
  let result = '';
  let cursor = 0;
  for (const link of parseNoteWikilinks(text)) {
    result += escapeHtml(text.slice(cursor, link.startIndex));
    const label = escapeHtml(link.display ?? link.target ?? link.rawTarget);
    const resolved = resolveHref(link.target);
    const href = resolved?.startsWith('/') ? appendWikilinkAnchor(resolved, link) : undefined;
    result += href
      ? `<a href="${escapeHtml(href)}" class="text-primary underline decoration-primary/50 underline-offset-4 hover:text-primary-hover">${label}</a>`
      : label;
    cursor = link.startIndex + link.length;
  }
  return result + escapeHtml(text.slice(cursor));
}
