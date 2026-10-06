const help = document.querySelector<HTMLDialogElement>('#terminal-help');
document.querySelector('[data-terminal-help]')?.addEventListener('click', () => help?.showModal());
let prefix = '';
let prefixAt = 0;
const destinations: Record<string, string> = {
  h: '/',
  l: '/notes',
  p: '/dev',
  t: '/tools',
  a: '/about',
};

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  if (
    event.isComposing ||
    event.keyCode === 229 ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    target.closest('input, textarea, select, [contenteditable="true"]')
  )
    return;
  if (
    document.querySelector('dialog[open]') ||
    Array.from(document.querySelectorAll('[role="dialog"]')).some(
      (dialog) => dialog.getClientRects().length > 0,
    )
  )
    return;
  const browser = Array.from(document.querySelectorAll<HTMLElement>('[data-object-browser]')).find(
    (node) => !node.closest('[hidden]'),
  );
  if (prefix && Date.now() - prefixAt > 1200) prefix = '';
  if (prefix) {
    const previous = prefix;
    prefix = '';
    if (previous === 'g' && destinations[event.key]) {
      event.preventDefault();
      location.href = withUiMode(destinations[event.key], new URL(location.href));
      return;
    }
    if (previous === 'r' && /^[1-9]$/.test(event.key)) {
      browser
        ?.querySelectorAll<HTMLAnchorElement>('[data-object-relation]')
        [Number(event.key) - 1]?.click();
      event.preventDefault();
      return;
    }
  }
  if (event.key === 'g' || event.key === 'r') {
    prefix = event.key;
    prefixAt = Date.now();
    return;
  }
  if (event.key === '?') {
    event.preventDefault();
    help?.showModal();
  }
  if (event.key === '/') {
    event.preventDefault();
    Array.from(document.querySelectorAll<HTMLButtonElement>('.search-trigger'))
      .find((button) => button.getClientRects().length)
      ?.click();
  }
  if (/^[1-9]$/.test(event.key)) {
    const tab = document.querySelector<HTMLAnchorElement>(`[data-terminal-tab="${event.key}"]`);
    if (tab) {
      event.preventDefault();
      tab.click();
      return;
    }
  }
  if (event.key === 'f') {
    event.preventDefault();
    browser?.querySelector<HTMLButtonElement>('[data-facet-trigger]')?.click();
  }
  if (event.key === 'i') {
    event.preventDefault();
    browser?.querySelector<HTMLInputElement>('[data-object-filter]')?.focus();
  }
  if (event.key === 'u') {
    event.preventDefault();
    history.back();
  }
  if (
    event.key === 'j' ||
    event.key === 'ArrowDown' ||
    event.key === 'k' ||
    event.key === 'ArrowUp'
  ) {
    if (!browser || (target.closest('a, button') && !target.closest('[data-object-row]'))) return;
    event.preventDefault();
    browser.dispatchEvent(
      new CustomEvent('terminal-select', {
        detail: event.key === 'j' || event.key === 'ArrowDown' ? 1 : -1,
      }),
    );
  }
  if ((event.key === 'Enter' || event.key === 'o') && !target.closest('a, button')) {
    event.preventDefault();
    browser?.querySelector<HTMLAnchorElement>('[data-object-open]')?.click();
  }
  if (event.key === 'Escape') {
    const input = browser?.querySelector<HTMLInputElement>('[data-object-filter]');
    if (input) {
      input.value = '';
      browser?.dispatchEvent(new Event('terminal-clear'));
    }
  }
});
import { withUiMode } from '../domain/ui-mode';
