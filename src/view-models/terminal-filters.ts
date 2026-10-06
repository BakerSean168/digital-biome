import type { TerminalObject } from './terminal-object';
export interface FacetOption {
  key: string;
  group: string;
  value: string;
  count: number;
}
function values(item: TerminalObject): [string, string][] {
  const tags: [string, string][] = item.tags.map((tag) => [
    item.kind === 'note' || item.kind === 'external' ? '标签' : '分类',
    tag,
  ]);
  if (['service', 'host', 'network', 'platform', 'project'].includes(item.kind) && item.meta)
    tags.push(['状态', item.meta]);
  if (item.kind === 'service') tags.push(['访问', item.privateRef ? '需认证' : '公开']);
  if (item.kind === 'blog' && /^\d{4}-\d{2}/.test(item.meta))
    tags.push(['月份', item.meta.slice(0, 7)]);
  for (const [group, entries] of Object.entries(item.facets ?? {}))
    for (const value of entries) tags.push([group, value]);
  return tags;
}
export function facetOptions(items: TerminalObject[]): FacetOption[] {
  const options = new Map<string, FacetOption>();
  for (const item of items)
    for (const [group, value] of values(item)) {
      const key = JSON.stringify([group, value]);
      const option = options.get(key) ?? { key, group, value, count: 0 };
      option.count++;
      options.set(key, option);
    }
  return [...options.values()].sort(
    (a, b) => a.group.localeCompare(b.group) || a.value.localeCompare(b.value),
  );
}
export function applyFacets(
  items: TerminalObject[],
  options: FacetOption[],
  selected: Set<string>,
): TerminalObject[] {
  const groups = new Map<string, Set<string>>();
  for (const option of options)
    if (selected.has(option.key)) {
      const set = groups.get(option.group) ?? new Set<string>();
      set.add(option.value);
      groups.set(option.group, set);
    }
  return items.filter((item) => {
    const pairs = values(item);
    return [...groups].every(([group, allowed]) =>
      pairs.some(([g, v]) => g === group && allowed.has(v)),
    );
  });
}
export function objectPath(base: string, title?: string): string {
  const slug = title
    ?.toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
  return '~' + base.replace(/\/$/, '') + (slug ? '/' + slug : '');
}
