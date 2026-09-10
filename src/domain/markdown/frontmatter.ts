/**
 * Shared Markdown frontmatter adapter.
 *
 * Digital Biome owns publication/route projection, not YAML parsing semantics.
 * All local consumers that must inspect synced Markdown use this adapter so
 * build-time fallbacks cannot drift into separate line-oriented parsers.
 */

import { parse } from 'yaml';

export type FrontmatterRecord = Record<string, unknown>;

export interface ParsedMarkdownFrontmatter {
  data: FrontmatterRecord;
  body: string;
  raw: string | null;
  hasFrontmatter: boolean;
}

function isRecord(value: unknown): value is FrontmatterRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function splitMarkdownFrontmatter(text: string): { raw: string | null; body: string } {
  if (!text.startsWith('---')) return { raw: null, body: text };

  const lines = text.split('\n');
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      return {
        raw: lines.slice(1, index).join('\n'),
        body: lines.slice(index + 1).join('\n'),
      };
    }
  }

  return { raw: null, body: text };
}

export function parseFrontmatterRecord(raw: string, sourceLabel = 'markdown'): FrontmatterRecord {
  try {
    const parsed = parse(raw);
    if (parsed == null) return {};
    if (!isRecord(parsed)) {
      throw new Error('frontmatter root must be a mapping');
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid YAML frontmatter in ${sourceLabel}: ${message}`);
  }
}

export function parseMarkdownFrontmatter(
  text: string,
  sourceLabel = 'markdown',
): ParsedMarkdownFrontmatter {
  const { raw, body } = splitMarkdownFrontmatter(text);
  return {
    data: raw === null ? {} : parseFrontmatterRecord(raw, sourceLabel),
    body,
    raw,
    hasFrontmatter: raw !== null,
  };
}

export function frontmatterString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || undefined;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

export function frontmatterStringArray(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values.map(frontmatterString).filter((item): item is string => Boolean(item));
}

export function frontmatterBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

export function frontmatterNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function frontmatterRecord(value: unknown): FrontmatterRecord | undefined {
  return isRecord(value) ? value : undefined;
}

export function frontmatterRecordArray(value: unknown): FrontmatterRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const records = value.filter(isRecord);
  return records.length > 0 ? records : undefined;
}
