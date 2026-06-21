import { getCollection } from 'astro:content';
import { execSync } from 'child_process';
import { statSync } from 'fs';
import type {
  AssetCard,
  AssetRole,
  AssetType,
  Bookmark,
  Category,
  HomepageSection,
  HomepageConfig,
  NoteCollectionEntry,
  AssetNoteEntry,
} from '../types/notes';

const NOTES_PATH = 'src/data/obsidian';
const HOMEPAGE_FEATURED_BOOKMARK_SLUGS = [
  'chatgpt',
  'bilibili',
  'youtube',
  'pinterest',
  'github',
  'linux-do',
  'reddit',
] as const;

function fallbackTitle(note: NoteCollectionEntry): string {
  return note.id.split('/').pop()?.replace(/-/g, ' ') ?? note.id;
}

function normalizeTitle(note: NoteCollectionEntry): NoteCollectionEntry {
  if (!note.data.title) {
    note.data.title = fallbackTitle(note);
  }
  return note;
}

export function isAssetEntry(note: NoteCollectionEntry): boolean {
  return Boolean(note.data.asset_id && note.data.asset_type) || note.id.startsWith('obsidian/assets/');
}

function isPublicNoteEntry(note: NoteCollectionEntry): boolean {
  return !note.data.draft && !note.data.private && !isAssetEntry(note);
}

function isPublicAssetEntry(note: NoteCollectionEntry): note is AssetNoteEntry {
  return (
    !note.data.draft &&
    !note.data.private &&
    isAssetEntry(note) &&
    note.data.visibility === 'public' &&
    Boolean(note.data.asset_id) &&
    Boolean(note.data.asset_type)
  );
}

export function getAssetHref(asset: Pick<NoteCollectionEntry['data'], 'asset_id' | 'asset_type'>): string {
  if (!asset.asset_id || !asset.asset_type) {
    return '/';
  }

  if (asset.asset_type === 'service') {
    return `/services/${asset.asset_id}`;
  }

  if (asset.asset_type === 'tool') {
    return `/tools/${asset.asset_id}`;
  }

  return `/infrastructure/${asset.asset_id}`;
}

export function toAssetCard(note: NoteCollectionEntry): AssetCard {
  return {
    assetId: note.data.asset_id!,
    assetType: note.data.asset_type!,
    assetRole: inferAssetRole(note.data),
    title: note.data.title,
    description: note.data.description,
    href: getAssetHref(note.data),
    tags: note.data.tags || [],
    icon: note.data.icon,
    status: note.data.status,
    homepage: note.data.homepage,
    monitor: note.data.monitor,
    links: note.data.links || [],
  };
}

export function inferAssetRole(
  note: Pick<NoteCollectionEntry['data'], 'asset_role' | 'asset_type' | 'homepage' | 'tags'>
): AssetRole | undefined {
  if (note.asset_role) {
    return note.asset_role;
  }

  const tags = new Set(note.tags || []);

  if (tags.has('tech/personal-site')) {
    return 'showcase';
  }

  if (tags.has('tech/product')) {
    return 'product';
  }

  if (tags.has('tech/dashboard')) {
    return 'portal';
  }

  if (note.homepage?.section === 'projects') {
    return 'showcase';
  }

  if (note.asset_type === 'service') {
    return 'ops';
  }

  return undefined;
}

function sortByOrderThenTitle<T extends { title: string; homepage?: HomepageConfig }>(items: T[]): T[] {
  return items.sort((a, b) => {
    const aOrder = a.homepage?.order ?? 100;
    const bOrder = b.homepage?.order ?? 100;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.title.localeCompare(b.title, 'zh-CN');
  });
}

export async function getAllNotes(): Promise<NoteCollectionEntry[]> {
  const allNotes = await getCollection('notes');
  return allNotes.map(note => normalizeTitle(note as NoteCollectionEntry));
}

export async function getPublicNotes(): Promise<NoteCollectionEntry[]> {
  const allNotes = await getAllNotes();
  return allNotes.filter(isPublicNoteEntry);
}

export async function getPublicAssets(): Promise<AssetNoteEntry[]> {
  const allNotes = await getAllNotes();
  return allNotes.filter(isPublicAssetEntry);
}

export async function getAssetByAssetId(assetId: string): Promise<AssetNoteEntry | undefined> {
  const assets = await getPublicAssets();
  return assets.find(asset => asset.data.asset_id === assetId);
}

export async function getAssetsByAssetIds(assetIds: string[]): Promise<AssetNoteEntry[]> {
  const wanted = new Set(assetIds);
  const assets = await getPublicAssets();
  return assets.filter(asset => wanted.has(asset.data.asset_id));
}

export async function getAssetsByType(assetType: AssetType): Promise<AssetNoteEntry[]> {
  const assets = await getPublicAssets();
  return assets
    .filter(asset => asset.data.asset_type === assetType)
    .sort((a, b) => a.data.title.localeCompare(b.data.title, 'zh-CN'));
}

export async function getHomepageAssets(section: HomepageSection): Promise<AssetCard[]> {
  const assets = await getPublicAssets();
  const featured = assets
    .filter(asset => asset.data.homepage?.featured && asset.data.homepage?.section === section)
    .map(toAssetCard);

  return sortByOrderThenTitle(featured);
}

export async function getAssetsByHomepageSection(section: HomepageSection): Promise<AssetNoteEntry[]> {
  const assets = await getPublicAssets();
  return assets
    .filter(asset => asset.data.homepage?.featured && asset.data.homepage?.section === section)
    .sort((a, b) => {
      const orderDiff = (a.data.homepage?.order ?? 100) - (b.data.homepage?.order ?? 100);
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return a.data.title.localeCompare(b.data.title, 'zh-CN');
    });
}

export async function getServiceDisplayGroups(): Promise<{
  operations: AssetCard[];
  projects: AssetCard[];
}> {
  const assets = await getPublicAssets();
  const services = assets
    .filter(asset => asset.data.asset_type === 'service')
    .map(toAssetCard);

  return {
    operations: sortByOrderThenTitle(
      services.filter(asset => !asset.assetRole || asset.assetRole === 'ops' || asset.assetRole === 'portal')
    ),
    projects: sortByOrderThenTitle(
      services.filter(asset => asset.assetRole === 'product' || asset.assetRole === 'showcase')
    ),
  };
}

export async function getInfrastructureAssets(): Promise<AssetCard[]> {
  const assets = await getPublicAssets();
  return assets
    .filter(asset => asset.data.asset_type === 'host' || asset.data.asset_type === 'network')
    .map(toAssetCard)
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
}

export async function getRelatedAssetsByParent(assetId: string): Promise<AssetNoteEntry[]> {
  const assets = await getPublicAssets();
  return assets
    .filter(asset => asset.data.parent_asset_id === assetId || asset.data.host_asset_id === assetId)
    .sort((a, b) => a.data.title.localeCompare(b.data.title, 'zh-CN'));
}

export async function getResourceTypes(): Promise<string[]> {
  const allNotes = await getAllNotes();
  const configNote = allNotes.find(n => n.id === 'obsidian/config/dashboard-resource-types' || n.id === 'obsidian/config/dashboard-resource-types.md');
  if (configNote?.data?.tags) {
    return configNote.data.tags.map((t: string) => t.toLowerCase());
  }
  return [];
}

export async function getBookmarks(): Promise<Bookmark[]> {
  const notes = await getPublicNotes();
  const resourceTypes = await getResourceTypes();

  return notes
    .filter(note => {
      const tags = note.data.tags || [];
      const hasWebsite = tags.some((tag: string) => tag.toLowerCase() === 'website');
      const hasResource = tags.some((tag: string) => tag.toLowerCase() === 'resource');

      const isLegacy = note.data.url && tags.some((tag: string) => tag === 'type/resource');
      const isNew = note.data.url && hasWebsite && hasResource && extractCategories(tags, resourceTypes).length > 0;

      return isLegacy || isNew;
    })
    .map(note => ({
      title: note.data.title,
      url: note.data.url!,
      description: note.data.description,
      categories: extractCategories(note.data.tags || [], resourceTypes),
      icon: note.data.icon,
      slug: note.id,
    }));
}

export async function getCategories(): Promise<Category[]> {
  const notes = await getPublicNotes();
  const resourceTypes = await getResourceTypes();
  const categoryMap = new Map<string, number>();

  notes.forEach(note => {
    const cats = extractCategories(note.data.tags || [], resourceTypes);
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

export async function getHomepageFeaturedBookmarks(): Promise<Bookmark[]> {
  const bookmarks = await getBookmarks();
  const bookmarkMap = new Map(
    bookmarks.map(bookmark => [bookmark.slug.split('/').pop()?.toLowerCase(), bookmark] as const)
  );

  return HOMEPAGE_FEATURED_BOOKMARK_SLUGS
    .map(slug => bookmarkMap.get(slug))
    .filter((bookmark): bookmark is Bookmark => Boolean(bookmark));
}

function extractCategories(tags: string[], resourceTypes: string[]): string[] {
  const categories = new Set<string>();

  tags.forEach(tag => {
    const lowerTag = tag.toLowerCase();

    if (lowerTag.startsWith('website/')) {
      const parts = tag.replace(/^website\//i, '').split('/');
      categories.add(parts[parts.length - 1]);
    }

    if (resourceTypes.includes(lowerTag)) {
      categories.add(lowerTag);
    }
  });

  return Array.from(categories);
}

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

export function extractTagRoots(tags: string[]): string[] {
  const roots = new Set<string>();
  tags.forEach(tag => {
    const root = tag.split('/')[0];
    roots.add(root);
  });
  return Array.from(roots);
}

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

    return result ? new Date(parseInt(result, 10) * 1000) : null;
  } catch {
    return null;
  }
}

function getGitLastModifiedMap(basePath: string): Map<string, Date> {
  try {
    const output = execSync(
      `git log --format="__TS__%ct" --name-only -- "${basePath}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString();

    const fileToDate = new Map<string, Date>();
    let currentTimestamp: Date | null = null;

    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (line.startsWith('__TS__')) {
        const unixSeconds = Number.parseInt(line.slice('__TS__'.length), 10);
        currentTimestamp = Number.isNaN(unixSeconds) ? null : new Date(unixSeconds * 1000);
        continue;
      }

      if (!currentTimestamp) {
        continue;
      }

      const normalizedPath = line.replace(/\\/g, '/');
      if (!fileToDate.has(normalizedPath)) {
        fileToDate.set(normalizedPath, currentTimestamp);
      }
    }

    return fileToDate;
  } catch {
    return new Map();
  }
}

function getFileLastModified(filePath: string): Date | null {
  try {
    return statSync(filePath).mtime;
  } catch {
    return null;
  }
}

export async function getRecentNotes(limit: number = 5): Promise<NoteCollectionEntry[]> {
  const notes = await getPublicNotes();
  const modifiedMap = getGitLastModifiedMap(NOTES_PATH);

  const notesWithModified = notes.map(note => {
    const relPath = note.id.replace(/^obsidian\//, '');
    const filePath = `${NOTES_PATH}/${relPath}.md`;
    return {
      note,
      lastModified: modifiedMap.get(filePath) ?? getFileLastModified(filePath) ?? getGitLastModified(filePath),
    };
  });

  return notesWithModified
    .filter(({ lastModified }) => lastModified !== null)
    .sort((a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0))
    .slice(0, limit)
    .map(({ note }) => note);
}

export interface NoteWithDate {
  note: NoteCollectionEntry;
  date: Date;
}

export async function getRecentNotesWithDate(limit: number = 5): Promise<NoteWithDate[]> {
  const notes = await getPublicNotes();
  const modifiedMap = getGitLastModifiedMap(NOTES_PATH);

  const notesWithModified = notes.map(note => {
    const relPath = note.id.replace(/^obsidian\//, '');
    const filePath = `${NOTES_PATH}/${relPath}.md`;
    return {
      note,
      lastModified: modifiedMap.get(filePath) ?? getFileLastModified(filePath) ?? getGitLastModified(filePath),
    };
  });

  return notesWithModified
    .filter((item): item is { note: NoteCollectionEntry; lastModified: Date } => item.lastModified !== null)
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
    .slice(0, limit)
    .map(({ note, lastModified }) => ({
      note,
      date: lastModified,
    }));
}

export async function getNewCreatedNotes(limit: number = 5): Promise<NoteCollectionEntry[]> {
  const notes = await getPublicNotes();
  return notes
    .filter(note => note.data.created !== null && note.data.created !== undefined)
    .sort((a, b) => {
      const aDate = new Date(a.data.created!);
      const bDate = new Date(b.data.created!);
      return bDate.getTime() - aDate.getTime();
    })
    .slice(0, limit);
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
