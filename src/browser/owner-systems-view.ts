import type { OwnerDomain, OwnerSystemsPayload } from './owner-systems-data';

const relationLabels = {
  canonical: 'Primary',
  transitional: 'Transition',
  archived: 'Archive',
  external: 'External',
} as const;

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderOwnerDomain(doc: Document, domain: OwnerDomain): HTMLElement {
  const details = element(doc, 'details', 'group/domain');
  details.dataset.ownerSystemDomain = domain.id;
  const summary = element(
    doc,
    'summary',
    'grid cursor-pointer list-none gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center [&::-webkit-details-marker]:hidden',
  );
  const title = element(
    doc,
    'span',
    'text-sm font-medium text-foreground group-open/domain:text-primary',
    domain.name,
  );
  title.append(element(doc, 'span', 'ml-2 text-xs text-amber-300', 'Owner'));
  summary.append(
    title,
    element(doc, 'span', 'text-sm text-muted-foreground', `${domain.repositories.length} repos`),
    element(
      doc,
      'span',
      'text-sm text-muted-foreground transition-transform group-open/domain:rotate-90',
      '→',
    ),
  );
  details.append(summary);
  const body = element(doc, 'div', 'pb-4 pl-4 sm:pl-6');
  const list = element(doc, 'div', 'divide-y divide-border/30 border-t border-border/30');
  for (const repository of domain.repositories) {
    const row = element(doc, 'div', 'flex items-center justify-between gap-4 py-3 text-sm');
    const identity = element(doc, 'div', 'min-w-0');
    identity.append(
      element(doc, 'span', 'font-mono text-foreground', repository.id),
      element(
        doc,
        'span',
        'ml-3 text-xs text-muted-foreground',
        relationLabels[repository.relation],
      ),
    );
    row.append(identity);
    if (repository.webUrl) {
      const link = element(doc, 'a', 'shrink-0 text-primary hover:text-foreground', 'GitHub ↗');
      // Only validated GitHub URLs reach this owner renderer.
      link.href = repository.webUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      row.append(link);
    }
    list.append(row);
  }
  body.append(list);
  details.append(body);
  return details;
}

/** Only append owner domains after the *complete* protected response was validated. */
export function renderOwnerSystems(
  doc: Document,
  grid: HTMLElement,
  gate: HTMLElement,
  payload: OwnerSystemsPayload,
): void {
  const fragment = doc.createDocumentFragment();
  for (const domain of payload.domains) fragment.append(renderOwnerDomain(doc, domain));
  grid.querySelectorAll('[data-owner-system-domain]').forEach((node) => {
    node.remove();
  });
  grid.insertBefore(fragment, gate.isConnected ? gate : null);
  gate.remove();
}

/** Clear runtime-only owner data before caching/restoring a page in browser history. */
export function clearOwnerSystems(grid: HTMLElement, gate: HTMLElement): void {
  grid.querySelectorAll('[data-owner-system-domain]').forEach((node) => {
    node.remove();
  });
  if (!gate.isConnected) grid.append(gate);
}
