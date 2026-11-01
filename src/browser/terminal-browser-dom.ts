import type { TerminalLink, TerminalObject } from '../view-models/terminal-object';

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function linkNode(link: TerminalLink, label = link.title): HTMLAnchorElement {
  const anchor = element('a', 'block py-1 hover:text-primary', label);
  anchor.href = link.href;
  if (/^https?:/.test(link.href)) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  return anchor;
}

export function required<T extends Element>(root: Element, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`Missing object browser element: ${selector}`);
  return node;
}

export function paintTerminalPreview(
  preview: HTMLElement,
  item: TerminalObject,
  source: HTMLAnchorElement,
): void {
  const open = source.cloneNode(false) as HTMLAnchorElement;
  open.removeAttribute('data-object');
  open.removeAttribute('data-object-row');
  open.removeAttribute('aria-current');
  open.className = 'mt-5 inline-block text-primary hover:underline';
  open.dataset.objectOpen = '';
  open.textContent =
    item.privateRef && source.getAttribute('href')?.startsWith('/login') ? 'Access →' : '打开 ↗';
  const tags = element(
    'p',
    'object-detail-tags mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground',
  );
  for (const tag of item.tags) {
    const token = element('span', '', tag.split('/').pop());
    token.title = tag;
    tags.append(token);
  }
  preview.replaceChildren(
    element('h2', 'text-lg font-semibold text-primary', item.title),
    element(
      'p',
      'object-detail-meta mt-3 text-xs text-muted-foreground',
      `${item.kind} · ${item.meta}`,
    ),
    element('p', 'object-detail-description mt-3 break-words', item.description),
    tags,
    open,
  );
  if (item.relations.length) {
    const related = element('div', 'mt-5 border-t border-border pt-3');
    related.append(element('h3', 'mb-2 text-xs text-muted-foreground', '关联'));
    item.relations.forEach((link, i) => {
      const anchor = linkNode(link, `[${i + 1}] ${link.title}`);
      anchor.dataset.objectRelation = '';
      related.append(anchor);
    });
    preview.append(related);
  }
}

export function materializeTerminalRows(
  filtered: readonly TerminalObject[],
  limit: number,
  knownRows: Map<string, HTMLAnchorElement>,
): HTMLAnchorElement[] {
  return filtered.slice(0, limit).map((item) => {
    const existing = knownRows.get(item.id);
    if (existing) return existing;
    const row = linkNode(item);
    row.className = 'terminal-row';
    row.dataset.objectRow = '';
    if (item.privateRef) row.dataset.privateLink = item.privateRef;
    row.dataset.object = JSON.stringify(item);
    const title = element('strong', '', item.title);
    title.dataset.objectTitle = '';
    const symbol = element('span', 'text-muted-foreground', item.kind === 'note' ? '§' : ':');
    symbol.dataset.objectSymbol = '';
    const direct = element(
      'span',
      '',
      item.privateRef ? 'Access' : /^https?:/.test(item.href) ? '打开 ↗' : '查看 →',
    );
    direct.dataset.objectDirect = '';
    direct.dataset.uiOnly = 'gui';
    row.replaceChildren(
      element('span', 'terminal-pointer', '>'),
      symbol,
      title,
      element('span', 'terminal-description', item.description),
      element('span', 'terminal-meta', item.meta),
      direct,
    );
    knownRows.set(item.id, row);
    return row;
  });
}
