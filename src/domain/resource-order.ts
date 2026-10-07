/** Public resource ordering; timestamps and search relevance keep their own rules. */
export function parseUsagePriority(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('usagePriority must be a positive integer');
  }
  return value;
}

interface NamedResource {
  id: string;
  title: string;
}

const titleOrder = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

export function compareResourceTitle(a: NamedResource, b: NamedResource): number {
  return titleOrder.compare(a.title, b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function compareResourcePriority(
  a: NamedResource & { usagePriority?: number | null },
  b: NamedResource & { usagePriority?: number | null },
): number {
  const first = a.usagePriority ?? Infinity;
  const second = b.usagePriority ?? Infinity;
  return (first === second ? 0 : first < second ? -1 : 1) || compareResourceTitle(a, b);
}
