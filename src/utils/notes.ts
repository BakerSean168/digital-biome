import { getCollection, type CollectionEntry } from 'astro:content';
import { execSync } from 'child_process';
import { notesConfig } from '../../notes.config';
import type { Note, Bookmark, Category, NoteCollectionEntry } from '../types/notes';

const NOTES_PATH = notesConfig.output.notes; // e.g. 'src/content/notes/obsidian'

export async function getPublicNotes(): Promise<NoteCollectionEntry[]> {
  const allNotes = await getCollection('notes');
  return allNotes.filter(note =>
    !note.data.draft &&
    !(note.data as any).private
  ).map(note => {
    if (!note.data.title) {
      // id 格式: "obsidian/filename"，取最后一段作为回退标题
      note.data.title = note.id.split('/').pop()?.replace(/-/g, ' ') ?? note.id;
    }
    return note;
  }) as NoteCollectionEntry[];
}

export async function getBookmarks(): Promise<Bookmark[]> {
  const notes = await getPublicNotes();

  return notes
    .filter(note =>
      note.data.url &&
      note.data.tags?.some((tag: string) => tag === 'type/resource')
    )
    .map(note => ({
      title: note.data.title,
      url: note.data.url!,
      description: note.data.description,
      categories: extractCategories(note.data.tags || []),
      icon: note.data.icon,
      slug: note.id,
    }));
}

export async function getCategories(): Promise<Category[]> {
  const notes = await getPublicNotes();
  const categoryMap = new Map<string, number>();

  notes.forEach(note => {
    const cats = extractCategories(note.data.tags || []);
    cats.forEach(cat => {
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });
  });

  return Array.from(categoryMap.entries())
    .map(([name, count]) => ({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getBookmarksByCategory(): Promise<Map<string, Bookmark[]>> {
  const bookmarks = await getBookmarks();
  const categoryMap = new Map<string, Bookmark[]>();

  bookmarks.forEach(bookmark => {
    bookmark.categories.forEach(category => {
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(bookmark);
    });
  });

  return categoryMap;
}

/**
 * 从层级标签中提取书签分类
 * 书签笔记使用 website/ 前缀标签，例如 website/video, website/dev/tool
 * 提取最后一段作为分类名
 */
function extractCategories(tags: string[]): string[] {
  return tags
    .filter(tag => tag.startsWith('website/'))
    .map(tag => {
      const parts = tag.replace('website/', '').split('/');
      return parts[parts.length - 1];
    });
}

/**
 * 解析层级标签为结构化对象
 * 例如 "tech/lang/typescript" → { root: "tech", path: ["tech", "lang", "typescript"], display: "typescript", full: "tech/lang/typescript" }
 */
export interface ParsedTag {
  root: string;
  path: string[];
  display: string;
  full: string;
}

export function parseHierarchicalTag(tag: string): ParsedTag {
  const parts = tag.split('/');
  return {
    root: parts[0],
    path: parts,
    display: parts[parts.length - 1],
    full: tag,
  };
}

/**
 * 从标签数组中提取顶层分类（root 维度去重）
 * 用于侧边栏分类导航
 */
export function extractTagRoots(tags: string[]): string[] {
  const roots = new Set<string>();
  tags.forEach(tag => {
    const root = tag.split('/')[0];
    roots.add(root);
  });
  return Array.from(roots);
}

/**
 * 获取所有笔记的标签统计（支持层级展示）
 */
export async function getAllNoteTags(): Promise<Map<string, number>> {
  const notes = await getPublicNotes();
  const tagMap = new Map<string, number>();

  notes.forEach(note => {
    const tags = note.data.tags || [];
    tags.forEach((tag: string) => {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    });
  });

  return tagMap;
}

export function getGitLastModified(filePath: string): Date | null {
  try {
    const result = execSync(
      `git log -1 --format="%ct" -- "${filePath}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim();

    return result ? new Date(parseInt(result) * 1000) : null;
  } catch {
    return null;
  }
}

export async function getRecentNotes(limit: number = 5): Promise<NoteCollectionEntry[]> {
  const notes = await getPublicNotes();

  // note.id = "obsidian/filename"，对应文件在 WIKI_PATH/filename.md
  // 但 git log 要查的是 thought-forest submodule 中的原始文件（更准确）
  // 或者查同步后的文件，两者 mtime 相同，用同步后的路径即可
  const notesWithModified = notes.map(note => {
    // note.id: "obsidian/foo/bar" → file: "src/content/wiki/obsidian/foo/bar.md"
    const relPath = note.id.replace(/^obsidian\//, '');
    const filePath = `${NOTES_PATH}/${relPath}.md`;
    return { note, lastModified: getGitLastModified(filePath) };
  });

  return notesWithModified
    .filter(({ lastModified }) => lastModified !== null)
    .sort((a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0))
    .slice(0, limit)
    .map(({ note }) => note);
}

export function resolveNoteLink(
  target: string,
  allNotes: NoteCollectionEntry[]
): { exists: boolean; slug?: string } {
  const normalizedTarget = target.toLowerCase().trim();

  const match = allNotes.find(note => {
    const title = (note.data.title ?? '').toLowerCase();
    const id = note.id.toLowerCase();
    const aliases = (note.data.aliases || []).map((a: string) => a.toLowerCase());

    return (
      title === normalizedTarget ||
      id === normalizedTarget ||
      id.endsWith('/' + normalizedTarget) ||
      aliases.includes(normalizedTarget)
    );
  });

  return { exists: !!match, slug: match?.id };
}
