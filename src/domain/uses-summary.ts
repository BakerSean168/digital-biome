export interface UsesSummary {
  id: string;
  title: string;
  description: string;
  group: string;
  order?: number;
}

/** This boundary accepts no private identity, body, URL or link metadata. */
export function parseUsesSummaries(value: unknown): UsesSummary[] {
  if (!Array.isArray(value)) throw new Error('usesSummaries must be an array');
  const seen = new Set<string>();
  return value.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('Invalid uses summary');
    const item = raw as Record<string, unknown>;
    if (
      Object.keys(item).some(
        (key) => !['id', 'title', 'description', 'group', 'order'].includes(key),
      )
    )
      throw new Error('Unexpected uses summary field');
    if (
      typeof item.id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]{1,39}$/.test(item.id) ||
      seen.has(item.id)
    )
      throw new Error('Invalid or duplicate uses summary id');
    seen.add(item.id);
    for (const [field, limit] of [
      ['title', 100],
      ['description', 250],
      ['group', 40],
    ] as const) {
      const text = item[field];
      if (
        typeof text !== 'string' ||
        !text.trim() ||
        text.length > limit ||
        [...text].some((char) => char.charCodeAt(0) < 32) ||
        /[<>[\]{}`]|(?:https?:|ssh:|www\.|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i.test(text)
      )
        throw new Error('Invalid uses summary text');
    }
    if (
      item.order !== undefined &&
      (typeof item.order !== 'number' ||
        !Number.isInteger(item.order) ||
        item.order < 0 ||
        item.order > 1000)
    )
      throw new Error('Invalid uses summary order');
    return {
      id: item.id,
      title: item.title as string,
      description: item.description as string,
      group: item.group as string,
      ...(item.order === undefined ? {} : { order: item.order as number }),
    };
  });
}
