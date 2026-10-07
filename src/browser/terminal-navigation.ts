import { PRIMARY_NAVIGATION } from '../config/navigation-policy';
import { withUiMode } from '../domain/ui-mode';

const help = document.querySelector<HTMLDialogElement>('#terminal-help');
const feedback = document.querySelector<HTMLElement>('[data-command-feedback]');
const message = document.querySelector<HTMLElement>('[data-command-message]');
const choices = document.querySelector<HTMLElement>('[data-command-choices]');
const enabled = document.querySelector<HTMLInputElement>('[data-shortcuts-enabled]');
const timeout = document.querySelector<HTMLSelectElement>('[data-command-timeout]');
const preferenceKey = 'digital-biome.shortcuts';
let shortcutsEnabled = true;
let commandTimeout = 2000;
let timer: ReturnType<typeof setTimeout> | undefined;
let navigationTimer: ReturnType<typeof setTimeout> | undefined;
let navigating = false;
type Choice = { key: string; title: string; run: () => void };
let prefix: { key: string; choices: Choice[] } | undefined;

function clearPrefix() {
  clearTimeout(timer);
  prefix = undefined;
  choices?.replaceChildren();
  if (feedback && !navigating) feedback.hidden = true;
}
function announce(text: string, transient = true) {
  clearPrefix();
  if (feedback) feedback.hidden = false;
  if (message) message.textContent = text;
  if (transient) timer = setTimeout(clearPrefix, 1800);
}
function currentBrowser() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-object-browser]')).find(
    (node) => node.getClientRects().length > 0,
  );
}
function startNavigation(href: string, title: string) {
  const url = new URL(href, location.href);
  if (
    url.origin !== location.origin ||
    !['http:', 'https:'].includes(url.protocol) ||
    /^\/(login|api|cdn-cgi|data)(\/|$)/.test(url.pathname) ||
    (url.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '') &&
      url.search === location.search)
  )
    return true;
  if (navigating) return false;
  clearPrefix();
  navigating = true;
  announce(`前往 ${title}…`, false);
  feedback?.setAttribute('data-navigating', '');
  navigationTimer = setTimeout(() => {
    if (message) message.textContent = `仍在加载 ${title}…`;
  }, 2000);
  return true;
}
function reset() {
  navigating = false;
  clearTimeout(navigationTimer);
  feedback?.removeAttribute('data-navigating');
  clearPrefix();
}
function begin(key: string) {
  const browser = currentBrowser();
  const options: Choice[] =
    key === 'g'
      ? PRIMARY_NAVIGATION.map(({ title, href }) => ({
          key: title[0].toLowerCase(),
          title,
          run: () => {
            const destination = withUiMode(href, new URL(location.href));
            if (startNavigation(destination, title)) location.assign(destination);
          },
        }))
      : Array.from(browser?.querySelectorAll<HTMLAnchorElement>('[data-object-relation]') ?? [])
          .slice(0, 9)
          .map((anchor, i) => ({
            key: String(i + 1),
            title: (anchor.textContent ?? '').replace(/^\[\d+\]\s*/, ''),
            run: () => anchor.click(),
          }));
  if (!options.length) {
    announce('当前对象没有可用关联');
    return;
  }
  clearPrefix();
  prefix = { key, choices: options };
  if (feedback) feedback.hidden = false;
  if (message) message.textContent = `${key} · ${key === 'g' ? '前往' : '关联'} · Esc 取消`;
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'min-h-11 text-primary hover:underline md:min-h-8';
    button.textContent = `${option.key} ${option.title}`;
    button.onclick = () => {
      clearPrefix();
      option.run();
    };
    choices?.append(button);
  }
  timer = setTimeout(() => announce('命令已超时'), commandTimeout);
}
try {
  const value: unknown = JSON.parse(localStorage.getItem(preferenceKey) ?? 'null');
  if (value && typeof value === 'object') {
    if ('enabled' in value && typeof value.enabled === 'boolean') shortcutsEnabled = value.enabled;
    if ('timeout' in value && (value.timeout === 2000 || value.timeout === 5000))
      commandTimeout = value.timeout;
  }
} catch {
  /* Storage is optional; controls still work for this page. */
}
if (enabled) enabled.checked = shortcutsEnabled;
if (timeout) timeout.value = String(commandTimeout);
function savePreferences() {
  shortcutsEnabled = enabled?.checked ?? true;
  commandTimeout = timeout?.value === '5000' ? 5000 : 2000;
  clearPrefix();
  document.documentElement.dataset.shortcuts = shortcutsEnabled ? 'on' : 'off';
  try {
    localStorage.setItem(
      preferenceKey,
      JSON.stringify({ enabled: shortcutsEnabled, timeout: commandTimeout }),
    );
  } catch {
    /* Keep the in-memory choice. */
  }
}
document.documentElement.dataset.shortcuts = shortcutsEnabled ? 'on' : 'off';
enabled?.addEventListener('change', savePreferences);
timeout?.addEventListener('change', savePreferences);
document.querySelectorAll('[data-terminal-help]').forEach((button) => {
  button.addEventListener('click', () => {
    clearPrefix();
    help?.showModal();
  });
});
window.addEventListener('blur', clearPrefix);
window.addEventListener('pagehide', reset);
window.addEventListener('pageshow', reset);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearPrefix();
});
document.addEventListener('biome:ui-mode', clearPrefix);
document.addEventListener('focusin', (event) => {
  if (
    (event.target as Element).closest(
      'input, textarea, select, [contenteditable], dialog, [role="dialog"]',
    )
  )
    clearPrefix();
});
document.addEventListener('click', (event) => {
  const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (
    !anchor ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey ||
    anchor.hasAttribute('download') ||
    (anchor.target && anchor.target !== '_self')
  )
    return;
  if (!startNavigation(anchor.href, anchor.textContent?.trim() || '页面')) event.preventDefault();
});
document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  if (
    event.isComposing ||
    event.keyCode === 229 ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    target.closest('input, textarea, select, [contenteditable]')
  ) {
    clearPrefix();
    return;
  }
  if (
    document.querySelector('dialog[open]') ||
    Array.from(document.querySelectorAll('[role="dialog"]')).some(
      (dialog) => dialog.getClientRects().length > 0,
    )
  ) {
    clearPrefix();
    return;
  }
  if (!shortcutsEnabled && event.key.length === 1) return;
  if (navigating) return;
  const browser = currentBrowser();
  if (prefix) {
    if (event.key === 'Tab') {
      clearPrefix();
      return;
    }
    event.preventDefault();
    if (event.repeat) return;
    const option = prefix.choices.find((choice) => choice.key === event.key);
    clearPrefix();
    if (event.key === 'Escape') announce('已取消');
    else if (option) option.run();
    else announce('没有这个命令');
    return;
  }
  if (event.key === 'g' || event.key === 'r') {
    event.preventDefault();
    if (!event.repeat) begin(event.key);
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
  if (['j', 'k', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
    if (!browser || (target.closest('a, button') && !target.closest('[data-object-row]'))) return;
    event.preventDefault();
    browser.dispatchEvent(
      new CustomEvent('terminal-select', {
        detail: {
          delta: event.key === 'j' || event.key === 'ArrowDown' ? 1 : -1,
          key: event.key,
          repeat: event.repeat,
        },
      }),
    );
  }
  if ((event.key === 'Enter' || event.key === 'o') && !target.closest('a, button')) {
    event.preventDefault();
    browser?.querySelector<HTMLAnchorElement>('[data-object-open]')?.click();
  }
});
