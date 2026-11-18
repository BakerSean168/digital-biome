import { USES_HARDWARE, USES_SOFTWARE } from '../config/uses-profile';
import type { TerminalObject } from './terminal-object';

/** Present personal inventory through the same list browser used by other catalogs. */
export function usesHardwareObjects(): TerminalObject[] {
  return USES_HARDWARE.map((item, index) => ({
    id: `hardware-${index}`,
    kind: 'hardware',
    title: item.name,
    description: item.detail,
    meta: item.group.toLowerCase(),
    href: '/uses#hardware',
    tags: [item.group.toLowerCase()],
    facets: { 分类: [item.group] },
    relations: [],
  }));
}

export function usesSoftwareObjects(): TerminalObject[] {
  return USES_SOFTWARE.flatMap((group) =>
    group.items.map((item, index) => ({
      id: `software-${group.group.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`,
      kind: 'software',
      title: item.name,
      description: item.detail,
      meta: group.group.toLowerCase(),
      href: '/uses#software',
      tags: [group.group.toLowerCase()],
      facets: { 分类: [group.group] },
      relations: [],
    })),
  );
}
