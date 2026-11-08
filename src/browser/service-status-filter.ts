import { SERVICE_LIFECYCLE_FILTERS, type ServiceLifecycleFilter } from '../utils/service-lifecycle';

const validFilters = new Set<string>(SERVICE_LIFECYCLE_FILTERS.map((option) => option.id));

function isServiceFilter(value: string | null): value is ServiceLifecycleFilter {
  return value !== null && validFilters.has(value);
}

export function initializeServiceStatusFilters(): void {
  document.querySelectorAll<HTMLElement>('[data-service-filter-root]').forEach((root) => {
    if (root.dataset.serviceFilterInitialized === 'true') return;
    root.dataset.serviceFilterInitialized = 'true';

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-service-filter]'));
    const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-service-row]'));
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>('[data-service-category-section]'),
    );
    const visibleCount = root.querySelector<HTMLElement>('[data-service-visible-count]');
    const empty = root.querySelector<HTMLElement>('[data-service-empty]');

    function applyFilter(filter: ServiceLifecycleFilter, updateUrl = false): void {
      let total = 0;
      for (const row of rows) {
        const visible = filter === 'all' || row.dataset.serviceLifecycleGroup === filter;
        row.hidden = !visible;
        row.classList.toggle('hidden', !visible);
        if (visible) total += 1;
      }

      for (const section of sections) {
        const count = Array.from(
          section.querySelectorAll<HTMLElement>('[data-service-row]'),
        ).filter((row) => !row.hidden).length;
        section.hidden = count === 0;
        section.classList.toggle('hidden', count === 0);
        const categoryCount = section.querySelector<HTMLElement>('[data-service-category-count]');
        if (categoryCount) categoryCount.textContent = String(count);
      }

      for (const button of buttons) {
        button.setAttribute('aria-pressed', String(button.dataset.serviceFilter === filter));
      }

      if (visibleCount) visibleCount.textContent = `显示 ${total} 项`;
      if (empty) {
        empty.hidden = total !== 0;
        empty.classList.toggle('hidden', total !== 0);
      }

      if (updateUrl) {
        const url = new URL(window.location.href);
        if (filter === 'active') {
          url.searchParams.delete('serviceStatus');
        } else {
          url.searchParams.set('serviceStatus', filter);
        }
        window.history.replaceState(window.history.state, '', url);
      }
    }

    for (const button of buttons) {
      button.addEventListener('click', () => {
        const filter = button.dataset.serviceFilter ?? '';
        if (isServiceFilter(filter)) applyFilter(filter, true);
      });
    }

    const requested = new URLSearchParams(window.location.search).get('serviceStatus');
    let initial: ServiceLifecycleFilter = isServiceFilter(requested) ? requested : 'active';
    if (!isServiceFilter(requested) && window.location.hash.startsWith('#service-')) {
      const target = rows.find(
        (row) => row.id === decodeURIComponent(window.location.hash.slice(1)),
      );
      const group = target?.dataset.serviceLifecycleGroup ?? '';
      if (isServiceFilter(group)) initial = group;
    }
    applyFilter(initial);
  });
}
