/** Scroll ownership follows the visible layout, not a route or a CSS breakpoint. */
export function allowsNativeScroll(node: HTMLElement): boolean {
  return ['auto', 'scroll', 'overlay'].includes(getComputedStyle(node).overflowY);
}

export function pageScrollTarget(doc: Document = document): HTMLElement | null {
  const content = doc.getElementById('site-content');
  if (!content) return null;
  const panel = Array.from(content.querySelectorAll<HTMLElement>('[data-page-scroll]')).find(
    (node) => node.getClientRects().length > 0 && allowsNativeScroll(node),
  );
  return panel ?? (allowsNativeScroll(content) ? content : null);
}

/** Clip the list against every enclosing vertical scrollport (including mobile page flow). */
export function visibleVerticalBounds(node: HTMLElement): { top: number; bottom: number } {
  const rect = node.getBoundingClientRect();
  let top = Math.max(0, rect.top);
  let bottom = Math.min(window.innerHeight, rect.bottom);
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (parent.id !== 'site-content' && !allowsNativeScroll(parent)) continue;
    const bounds = parent.getBoundingClientRect();
    top = Math.max(top, bounds.top);
    bottom = Math.min(bottom, bounds.bottom);
  }
  return { top, bottom };
}

/** Keep a visible selection; after manual scrolling, resume from the nearest visible edge. */
export function catalogSelectionInView(
  rows: readonly Pick<HTMLElement, 'getBoundingClientRect'>[],
  selected: number,
  delta: number,
  bounds: { top: number; bottom: number },
): number | undefined {
  if (bounds.bottom <= bounds.top || !rows[selected]) return undefined;
  const intersects = (row: Pick<HTMLElement, 'getBoundingClientRect'>) => {
    const rect = row.getBoundingClientRect();
    return rect.bottom > bounds.top && rect.top < bounds.bottom;
  };
  if (intersects(rows[selected])) return undefined;
  const index = delta > 0 ? rows.findIndex(intersects) : rows.findLastIndex(intersects);
  return index >= 0 ? index : undefined;
}
