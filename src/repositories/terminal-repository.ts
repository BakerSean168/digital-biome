import { getBlogPosts } from './blogs-repository';
import { getBookmarks } from './bookmarks-repository';
import { getPublicNotes, getProjectShowcaseAssets } from '../utils/notes';
import { getInfrastructureResources, getInfrastructureConnections } from '../utils/infrastructure';
import { getPortalServices } from '../utils/personal-systems';
import { buildKnowledgeNoteHref } from '../domain/note-routing';
import { sortNoteCatalog, toNoteCatalogItem } from '../view-models/note-list-item';
import { isSafeTerminalHref, type TerminalObject } from '../view-models/terminal-object';

export function terminalBlogs(): TerminalObject[] {
  return getBlogPosts().map((post) => ({
    id: post.id,
    title: post.title,
    kind: 'blog',
    description: post.description ?? '',
    href: buildKnowledgeNoteHref(post.id.replace(/^note\//, '')),
    meta: (post.updated || post.created || '').slice(0, 10),
    tags: post.tags ?? [],
    relations: [],
  }));
}

export async function terminalNotes(): Promise<TerminalObject[]> {
  const blogIds = new Set(getBlogPosts().map((post) => post.id.replace(/^note\//, '')));
  return sortNoteCatalog(
    (await getPublicNotes())
      .filter((note) => !blogIds.has(note.id.replace(/^note\//, '')))
      .map((note) => toNoteCatalogItem(note)),
  ).map((note) => ({
    id: note.id,
    title: note.title,
    kind: 'note',
    description: note.description,
    href: note.href,
    meta: note.timestamp ? new Date(note.timestamp).toISOString().slice(0, 10) : '',
    tags: note.tags,
    relations: [],
  }));
}

export function terminalProjects(): TerminalObject[] {
  return getProjectShowcaseAssets().map((project) => ({
    id: project.assetId,
    title: project.title,
    kind: 'project',
    description: project.description ?? '',
    href: project.href,
    meta: project.status ?? '',
    tags: project.tags,
    facets: {
      线上: project.links.some(
        (link) =>
          link.visibility !== 'private' &&
          link.url &&
          isSafeTerminalHref(link.url) &&
          !/github\.com|gitlab\.com/.test(link.url),
      )
        ? ['有线上地址']
        : [],
      源码: project.links.some(
        (link) =>
          link.visibility !== 'private' &&
          link.url &&
          /https:\/\/(github|gitlab)\.com\//.test(link.url),
      )
        ? ['有源码']
        : [],
    },
    relations: project.links.flatMap((link) =>
      link.visibility !== 'private' && link.url && isSafeTerminalHref(link.url)
        ? [{ title: link.label, href: link.url }]
        : [],
    ),
  }));
}

export function terminalExternal(): TerminalObject[] {
  return getBookmarks()
    .filter((bookmark) => /^https?:\/\//i.test(bookmark.url) && isSafeTerminalHref(bookmark.url))
    .map((bookmark) => ({
      id: bookmark.slug,
      title: bookmark.title,
      kind: 'external',
      description: bookmark.description ?? '',
      href: bookmark.url,
      meta: bookmark.categories[0] ?? '',
      tags: bookmark.categories,
      relations: [],
    }));
}

export function terminalInfrastructure(): TerminalObject[] {
  const resources = getInfrastructureResources();
  const portals = new Map(getPortalServices().map((service) => [service.resource.id, service]));
  const connections = getInfrastructureConnections();
  return resources.map((resource) => {
    const portal = portals.get(resource.id);
    const primary = portal
      ? { url: portal.url, privateRef: portal.privateRef }
      : resource.links?.find((link) => link.url || link.privateRef);
    const relatedIds = new Set([
      resource.hostResourceId,
      resource.parentResourceId,
      ...resources
        .filter(
          (other) => other.hostResourceId === resource.id || other.parentResourceId === resource.id,
        )
        .map((other) => other.id),
      ...connections.flatMap((link) =>
        link.from === resource.id ? [link.to] : link.to === resource.id ? [link.from] : [],
      ),
    ]);
    return {
      id: resource.id,
      title: resource.title,
      kind: resource.kind,
      description: resource.description,
      tags: resource.groups,
      meta: resource.status,
      facets: {
        主机: resource.hostResourceId
          ? resources
              .filter((other) => other.id === resource.hostResourceId)
              .map((other) => other.title)
          : [],
        位置: resource.region ? [resource.region] : [],
      },
      href:
        primary?.url ??
        (primary?.privateRef ? '/login?next=%2Ftools' : `/infrastructure/${resource.id}`),
      privateRef: primary?.privateRef,
      relations: [
        { title: '资源详情', href: `/infrastructure/${resource.id}` },
        ...resources
          .filter((other) => relatedIds.has(other.id))
          .map((other) => ({ title: other.title, href: `/infrastructure/${other.id}` })),
      ],
    };
  });
}
