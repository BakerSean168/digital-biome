import { isImeComposition } from './ime-composition';
import { catalogSelectionInView, visibleVerticalBounds } from './page-scroll';

type Direction = 'left' | 'right' | 'up' | 'down';
type Bounds = Pick<DOMRect, 'top' | 'left' | 'width'>;

export function matchesDashboardQuery(text: string, query: string): boolean {
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase();
  const haystack = normalize(text);
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

/** Horizontal movement follows authored order; vertical movement follows rendered rows. */
export function dashboardNeighbor(
  bounds: readonly Bounds[],
  current: number,
  direction: Direction,
): number | undefined {
  if (!bounds.length) return undefined;
  if (current < 0) return 0;
  if (direction === 'left' || direction === 'right') {
    return Math.max(0, Math.min(bounds.length - 1, current + (direction === 'left' ? -1 : 1)));
  }
  const from = bounds[current];
  const sign = direction === 'up' ? -1 : 1;
  const candidates = bounds
    .map((rect, index) => ({
      index,
      distance: (rect.top - from.top) * sign,
      offset: Math.abs(rect.left + rect.width / 2 - from.left - from.width / 2),
    }))
    .filter((candidate) => candidate.distance > 4);
  if (!candidates.length) return undefined;
  const nearestRow = Math.min(...candidates.map((candidate) => candidate.distance));
  return candidates
    .filter((candidate) => candidate.distance - nearestRow <= 4)
    .sort((a, b) => a.offset - b.offset || a.index - b.index)[0]?.index;
}

const directions: Record<string, Direction> = {
  h: 'left',
  ArrowLeft: 'left',
  l: 'right',
  ArrowRight: 'right',
  k: 'up',
  ArrowUp: 'up',
  j: 'down',
  ArrowDown: 'down',
};

export function initDashboard(doc: Document = document): void {
  const root = doc.querySelector<HTMLElement>('[data-authored-page="dashboard"]');
  const input = root?.querySelector<HTMLInputElement>('[data-dashboard-search]');
  const count = root?.querySelector<HTMLElement>('[data-dashboard-count]');
  const empty = root?.querySelector<HTMLElement>('[data-dashboard-empty]');
  const status = root?.querySelector<HTMLElement>('[data-dashboard-status]');
  if (!root || !input || !count || !empty || !status) return;

  const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-dashboard-group]'));
  let parentTitle = '';
  const entries = groups.map((group) => {
    const title = group.dataset.dashboardTitle ?? '';
    const level = group.dataset.dashboardLevel;
    if (level === '2') parentTitle = title;
    const rows = Array.from(group.querySelectorAll<HTMLElement>('[data-dashboard-link]'));
    const links = rows.flatMap((row) => {
      const anchor = row.querySelector<HTMLAnchorElement>('[data-dashboard-target]');
      return anchor ? [{ row, anchor }] : [];
    });
    const button = group.querySelector<HTMLButtonElement>('[data-dashboard-open-group]');
    const list = group.querySelector<HTMLElement>('[data-dashboard-list]');
    return { group, title, parentTitle, level, links, button, list };
  });
  const total = entries.reduce((sum, entry) => sum + entry.links.length, 0);

  function visibleLinks(): HTMLAnchorElement[] {
    return entries.flatMap((entry) =>
      entry.links
        .filter(({ row }) => !row.hidden && !entry.group.hidden)
        .map(({ anchor }) => anchor),
    );
  }

  const filter = (): void => {
    let visibleCount = 0;
    for (const entry of entries) {
      let matching = 0;
      for (const { row } of entry.links) {
        row.hidden = !matchesDashboardQuery(
          [entry.parentTitle, entry.title, row.dataset.dashboardSearchText].join(' '),
          input.value,
        );
        if (!row.hidden) matching++;
      }
      visibleCount += matching;
      entry.group.hidden = matching === 0;
      if (entry.button) entry.button.hidden = matching === 0;
      if (entry.list) entry.list.hidden = matching === 0;
    }
    // A matching subsection keeps its parent heading visible, not unrelated parent links.
    let hasVisibleChild = false;
    for (const entry of [...entries].reverse()) {
      if (entry.level === '2') {
        if (hasVisibleChild) entry.group.hidden = false;
        hasVisibleChild = false;
      } else if (!entry.group.hidden) hasVisibleChild = true;
    }
    count.textContent = input.value.trim() ? `${visibleCount} / ${total} links` : `${total} links`;
    empty.hidden = visibleCount > 0;
    status.textContent = '';
  };

  const focusSearch = (): void => {
    input.focus();
    input.select();
  };

  function focusLink(link: HTMLAnchorElement | undefined): void {
    link?.focus({ preventScroll: true });
    link?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  input.addEventListener('input', filter);
  input.addEventListener('keydown', (event) => {
    if (isImeComposition(event) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (!event.repeat) focusLink(visibleLinks()[0]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      input.value = '';
      filter();
    }
  });

  // The global navigation owner forwards only unclaimed shortcuts (after g/r prefixes).
  root.addEventListener('dashboard-keydown', (customEvent) => {
    const event = (customEvent as CustomEvent<KeyboardEvent>).detail;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('[data-dashboard-target]');
    if (event.key === '/' || event.key === 'i' || (event.key === 'Escape' && anchor)) {
      event.preventDefault();
      if (!event.repeat) focusSearch();
      return;
    }

    if (target.closest('a, button') && !anchor) return;
    if (event.key === 'o' && anchor) {
      event.preventDefault();
      if (!event.repeat) anchor.click();
      return;
    }
    const direction = directions[event.key.toLowerCase()] ?? directions[event.key];
    if (!direction) return;
    const links = visibleLinks();
    if (!links.length) return;
    const current = anchor ? links.indexOf(anchor) : -1;
    const scrollport = root.querySelector<HTMLElement>('[data-uses-scroll]');
    const vertical = direction === 'up' || direction === 'down';
    const visibleSelection =
      scrollport && vertical
        ? catalogSelectionInView(
            links,
            Math.max(0, current),
            direction === 'down' ? 1 : -1,
            visibleVerticalBounds(scrollport),
          )
        : undefined;
    const index =
      visibleSelection ??
      dashboardNeighbor(
        links.map(
          (link) => link.closest('li')?.getBoundingClientRect() ?? link.getBoundingClientRect(),
        ),
        current,
        direction,
      );
    event.preventDefault();
    if (index !== undefined) focusLink(links[index]);
    else if (direction === 'up') focusSearch();
  });

  for (const entry of entries) {
    entry.button?.addEventListener('click', () => {
      // "全部" means the direct Markdown group, even when the search hides some entries.
      // Keep the calls synchronous to preserve the browser's user-activation window.
      for (const { anchor } of entry.links) {
        doc.defaultView?.open(anchor.href, '_blank', 'noopener,noreferrer');
      }
      status.textContent = `已请求打开 ${entry.links.length} 个网站；如有拦截，请允许此站点打开弹出式窗口。`;
    });
  }

  const controls = root.querySelector<HTMLElement>('[data-dashboard-controls]');
  if (controls) controls.hidden = false;
  filter();
}
