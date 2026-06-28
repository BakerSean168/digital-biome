/**
 * Index generator — produces static JSON indexes from synced markdown files.
 *
 * Generates 4 files in `src/data/indexes/`:
 *   - notes-index.json   — all note metadata
 *   - link-graph.json    — outgoing link graph
 *   - tag-index.json     — tag occurrence counts
 *   - asset-index.json   — asset subset
 *
 * Runs after `pnpm sync` has copied markdown to `src/data/obsidian/`.
 *
 * Imports pure logic from `src/domain/foundation/` — this script runs as
 * plain tsx outside Astro's module resolution, so it must NOT import from
 * `types/notes.ts` or any module that transitively depends on `astro:content`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Foundation imports (zero external dependencies) ──

import {
  ASSET_NOTE_PREFIX,
  NOTE_ID_PREFIX,
  GIT_TS_MARKER,
} from '../../src/domain/foundation/constants';
import { toNoteId } from '../../src/domain/foundation/note-id';
import { inferVisibility } from '../../src/domain/foundation/visibility';
import { parseWikilinks } from '../../src/domain/foundation/wikilink-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ── Frontmatter parser (mirrors static-note-catalog.ts logic) ──
// NOTE: The foundation layer only needs extractFrontmatter (raw text).
// This script needs the full parseFrontmatter (structured object), so
// we keep it here. If this grows, consider extracting to a shared module.

function extractFrontmatter(text: string): string | null {
  if (!text.startsWith('---')) return null;
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return lines.slice(1, i).join('\n');
  }
  return null;
}

function extractBody(text: string): string {
  if (!text.startsWith('---')) return text;
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return lines.slice(i + 1).join('\n');
  }
  return text;
}

function parseBooleanish(v: string | undefined): boolean {
  if (!v) return false;
  return v.trim().toLowerCase() === 'true';
}

function parseInlineList(v: string): string[] {
  const value = v.trim();
  if (!value.startsWith('[') || !value.endsWith(']')) {
    const item = value.replace(/^['"]|['"]$/g, '').trim();
    return item ? [item] : [];
  }
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];
  const items: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (const ch of inner) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === ',') {
      const item = current.trim().replace(/^['"]|['"]$/g, '');
      if (item) items.push(item);
      current = '';
      continue;
    }
    current += ch;
  }
  const tail = current.trim().replace(/^['"]|['"]$/g, '');
  if (tail) items.push(tail);
  return items;
}

interface RawFrontmatter {
  title?: string;
  description?: string;
  tags: string[];
  created?: string;
  updated?: string;
  draft: boolean;
  private: boolean;
  visibility?: string;
  type: string;
  url?: string;
  icon?: string;
  category?: string;
  aliases: string[];
  asset_id?: string;
  asset_type?: string;
  asset_role?: string;
  host_asset_id?: string;
  parent_asset_id?: string;
  status?: string;
  homepage?: Record<string, unknown>;
  monitor?: Record<string, unknown>;
  links?: Array<Record<string, unknown>>;
}

function parseFrontmatter(fm: string): RawFrontmatter {
  const result: RawFrontmatter = {
    tags: [],
    draft: false,
    private: false,
    type: 'note',
    aliases: [],
  };

  const lines = fm.split('\n');
  let currentKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Continuation of a list key
    if (currentKey && line.trimStart().startsWith('- ')) {
      const item = line.trimStart().slice(2).trim().replace(/^['"]|['"]$/g, '');
      if (item) {
        if (currentKey === 'tags') result.tags.push(item);
        else if (currentKey === 'aliases') result.aliases.push(item);
      }
      continue;
    }

    currentKey = null;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim();

    switch (key) {
      case 'title': result.title = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'description': result.description = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'tags':
        if (!value) { currentKey = 'tags'; }
        else { result.tags = parseInlineList(value); }
        break;
      case 'created': result.created = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'updated': result.updated = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'draft': result.draft = parseBooleanish(value); break;
      case 'private': result.private = parseBooleanish(value); break;
      case 'visibility': result.visibility = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'type': result.type = value.replace(/^['"]|['"]$/g, '') || 'note'; break;
      case 'url': result.url = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'icon': result.icon = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'category': result.category = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'aliases':
        if (!value) { currentKey = 'aliases'; }
        else { result.aliases = parseInlineList(value); }
        break;
      case 'asset_id': result.asset_id = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'asset_type': result.asset_type = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'asset_role': result.asset_role = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'host_asset_id': result.host_asset_id = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'parent_asset_id': result.parent_asset_id = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      case 'status': result.status = value.replace(/^['"]|['"]$/g, '') || undefined; break;
      default: break;
    }
  }

  return result;
}

// ── Markdown link parser (unique to build-indexes) ──

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff?)$/i;

function parseMarkdownLinks(text: string): string[] {
  const links: string[] = [];
  const regex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const url = match[2].trim();
    if (url.startsWith('http') || url.startsWith('#') || url.startsWith('/')) continue;
    if (IMAGE_EXT.test(url)) continue;
    links.push(url);
  }
  return links;
}

// ── Wikilink target extraction (uses foundation parser) ──

/** Extract unique wikilink target strings from markdown body text. */
function extractWikilinkTargets(body: string): string[] {
  const links = parseWikilinks(body);
  const targets = new Set<string>();
  for (const link of links) {
    if (!link.isImage && link.target) {
      targets.add(link.target);
    }
  }
  return [...targets];
}

// ── File walker ──

function walkMarkdown(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkMarkdown(fullPath));
    } else if (entry.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Index builder ──

interface ProcessedNote {
  id: string;
  filePath: string;
  fm: RawFrontmatter;
  isAsset: boolean;
  visibility: 'public' | 'private' | 'internal';
  outgoingTargets: string[];
}

function processNoteFile(filePath: string, notesRoot: string): ProcessedNote {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(notesRoot, filePath).replace(/\\/g, '/');
  const id = toNoteId(relativePath);
  const fmText = extractFrontmatter(raw);
  const fm = fmText ? parseFrontmatter(fmText) : { tags: [], draft: false, private: false, type: 'note', aliases: [] };
  const body = extractBody(raw);

  const isAsset = id.startsWith(ASSET_NOTE_PREFIX);
  const visibility = inferVisibility({
    draft: fm.draft,
    private: fm.private,
    visibility: fm.visibility,
    isAsset,
  });

  // Parse outgoing links from body — uses foundation wikilink parser
  const wikilinkTargets = extractWikilinkTargets(body);
  const mdLinkTargets = parseMarkdownLinks(body);
  const outgoingTargets = [...new Set([...wikilinkTargets, ...mdLinkTargets])];

  return { id, filePath: relativePath, fm, isAsset, visibility, outgoingTargets };
}

function normalizeDate(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/^['"]|['"]$/g, '').trim();
  if (!cleaned) return undefined;
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function buildIndexes(notesRoot?: string): void {
  const root = notesRoot ?? path.join(PROJECT_ROOT, 'src', 'data', 'obsidian');
  const outDir = path.join(PROJECT_ROOT, 'src', 'data', 'indexes');

  if (!fs.existsSync(root)) {
    console.log(`  [build-indexes] Notes root not found: ${root} — skipping`);
    return;
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const files = walkMarkdown(root);
  console.log(`  [build-indexes] Processing ${files.length} markdown files...`);

  const notes = files.map(f => processNoteFile(f, root));

  // Build note id set for wikilink resolution
  const noteIds = new Set(notes.map(n => n.id));
  const noteIdBasenameMap = new Map<string, string[]>();
  for (const id of noteIds) {
    const parts = id.split('/');
    const basename = parts[parts.length - 1];
    const existing = noteIdBasenameMap.get(basename) ?? [];
    existing.push(id);
    noteIdBasenameMap.set(basename, existing);
  }

  function resolveTarget(rawTarget: string): string | undefined {
    const asId = `${NOTE_ID_PREFIX}${rawTarget}`;
    if (noteIds.has(asId)) return asId;
    const basenameMatch = noteIdBasenameMap.get(rawTarget);
    if (basenameMatch && basenameMatch.length === 1) return basenameMatch[0];
    const lower = rawTarget.toLowerCase();
    const ciMatch = noteIdBasenameMap.get(lower);
    if (ciMatch && ciMatch.length === 1) return ciMatch[0];
    return undefined;
  }

  // ── notes-index.json ──
  const notesIndexEntries = notes.map(n => ({
    id: n.id,
    title: n.fm.title ?? '',
    description: n.fm.description,
    tags: n.fm.tags,
    created: normalizeDate(n.fm.created),
    updated: normalizeDate(n.fm.updated),
    draft: n.fm.draft,
    private: n.fm.private,
    visibility: n.visibility,
    type: n.fm.type,
    url: n.fm.url,
    icon: n.fm.icon,
    category: n.fm.category,
    aliases: n.fm.aliases,
    isAsset: n.isAsset,
    asset_id: n.fm.asset_id,
    asset_type: n.fm.asset_type as any,
    asset_role: n.fm.asset_role as any,
    host_asset_id: n.fm.host_asset_id,
    parent_asset_id: n.fm.parent_asset_id,
    homepage: n.fm.homepage as any,
    monitor: n.fm.monitor as any,
    links: n.fm.links as any,
    status: n.fm.status,
    filePath: n.filePath,
  }));

  const notesIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    entries: notesIndexEntries,
  };

  // ── link-graph.json ──
  const linkGraphEntries = notes.map(n => {
    const resolved = n.outgoingTargets
      .map(t => resolveTarget(t))
      .filter((id): id is string => id !== undefined);
    return {
      sourceId: n.id,
      outgoingIds: [...new Set(resolved)],
    };
  }).filter(e => e.outgoingIds.length > 0);

  const linkGraph = {
    version: 1,
    generatedAt: new Date().toISOString(),
    entries: linkGraphEntries,
  };

  // ── tag-index.json ──
  const tagCounts = new Map<string, number>();
  for (const n of notes) {
    if (n.visibility !== 'public') continue;
    for (const tag of n.fm.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const tagIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    tags: [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
  };

  // ── asset-index.json ──
  const assetEntries = notesIndexEntries.filter(e => e.isAsset && e.asset_id && e.asset_type);
  const assetIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    entries: assetEntries,
  };

  // ── Write files ──
  const writeJson = (name: string, data: unknown) => {
    const outPath = path.join(outDir, name);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`  [build-indexes] Wrote ${outPath}`);
  };

  writeJson('notes-index.json', notesIndex);
  writeJson('link-graph.json', linkGraph);
  writeJson('tag-index.json', tagIndex);
  writeJson('asset-index.json', assetIndex);

  console.log(`  [build-indexes] Done. ${notesIndexEntries.length} notes, ${linkGraphEntries.length} link entries, ${tagIndex.tags.length} tags, ${assetEntries.length} assets.`);
}

// ── CLI entry ──
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  buildIndexes();
}
