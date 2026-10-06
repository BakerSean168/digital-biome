/** Public presentation contract. Protected destinations stay behind privateRef. */
export interface TerminalLink {
  title: string;
  href: string;
  privateRef?: string;
}
export interface TerminalObject extends TerminalLink {
  id: string;
  kind: string;
  description: string;
  meta: string;
  tags: string[];
  relations: TerminalLink[];
  facets?: Record<string, string[]>;
}

export function isSafeTerminalHref(value: string): boolean {
  if ([...value].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 92))
    return false;
  if (/^\/(?!\/)/.test(value)) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isLink(value: unknown): value is TerminalLink {
  if (!value || typeof value !== 'object') return false;
  const link = value as Record<string, unknown>;
  return (
    typeof link.title === 'string' &&
    typeof link.href === 'string' &&
    isSafeTerminalHref(link.href) &&
    (link.privateRef === undefined || typeof link.privateRef === 'string')
  );
}

export function parseTerminalCatalog(value: unknown): TerminalObject[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => {
      if (!isLink(item)) return false;
      const row = item as Partial<TerminalObject>;
      return (
        typeof row.id === 'string' &&
        typeof row.kind === 'string' &&
        typeof row.description === 'string' &&
        typeof row.meta === 'string' &&
        (row.facets === undefined ||
          (row.facets !== null &&
            typeof row.facets === 'object' &&
            Object.values(row.facets).every(
              (values) =>
                Array.isArray(values) && values.every((value) => typeof value === 'string'),
            ))) &&
        Array.isArray(row.tags) &&
        row.tags.every((tag) => typeof tag === 'string') &&
        Array.isArray(row.relations) &&
        row.relations.every(isLink)
      );
    })
  )
    throw new Error('Invalid public object catalog');
  return value;
}

export function filterTerminalObjects(items: TerminalObject[], query: string): TerminalObject[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter((item) =>
    words.every((word) =>
      `${item.title} ${item.description} ${item.meta} ${item.tags.join(' ')}`
        .toLocaleLowerCase()
        .includes(word),
    ),
  );
}
