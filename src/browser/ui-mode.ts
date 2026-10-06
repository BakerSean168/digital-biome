import {
  parseUiMode,
  resolveUiMode,
  UI_MODE_STORAGE_KEY,
  urlAfterModeChoice,
  withUiMode,
  type UiMode,
} from '../domain/ui-mode';

const root = document.documentElement;
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-ui-mode-choice]'));
const decorated = new WeakMap<HTMLAnchorElement, { original: string; applied: string }>();

function decorate(anchor: HTMLAnchorElement) {
  if (anchor.hasAttribute('download')) return;
  const href = anchor.getAttribute('href');
  if (!href) return;
  const destination = new URL(href, location.href);
  if (
    destination.origin !== location.origin &&
    /^https?:$/.test(destination.protocol) &&
    !anchor.target
  ) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  const previous = decorated.get(anchor);
  const original = previous?.applied === href ? previous.original : href;
  const applied = withUiMode(original, new URL(location.href));
  if (applied !== href) anchor.setAttribute('href', applied);
  decorated.set(anchor, { original, applied });
}

function setMode(mode: UiMode) {
  root.dataset.ui = mode;
  buttons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.uiModeChoice === mode));
  });
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', mode === 'gui' ? '#151614' : '#0b0e0c');
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(decorate);
  const path = document.querySelector('[data-terminal-path]');
  if (path)
    path.textContent =
      mode === 'gui' ? location.pathname : `~${location.pathname === '/' ? '' : location.pathname}`;
  document.dispatchEvent(new CustomEvent('biome:ui-mode', { detail: mode }));
}

function readPreference() {
  try {
    return localStorage.getItem(UI_MODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

for (const button of buttons) {
  button.addEventListener('click', () => {
    const mode = parseUiMode(button.dataset.uiModeChoice);
    if (!mode) return;
    const content = document.getElementById('site-content');
    const top = content?.getBoundingClientRect().top ?? 0;
    const anchor = Array.from(
      content?.querySelectorAll<HTMLElement>('h1,h2,h3,p,[data-object-row]') ?? [],
    ).find((node) => {
      const b = node.getBoundingClientRect();
      return b.height > 0 && b.bottom > top + 16;
    });
    const logical = anchor?.closest<HTMLElement>('[data-reading-anchor]') ?? anchor;
    const readingKey = logical?.dataset.readingAnchor;
    const offset = (logical?.getBoundingClientRect().top ?? top) - top;
    let persisted = false;
    try {
      localStorage.setItem(UI_MODE_STORAGE_KEY, mode);
      persisted = true;
    } catch {
      /* URL remains a usable fallback. */
    }
    history.replaceState(
      history.state,
      '',
      urlAfterModeChoice(new URL(location.href), mode, persisted),
    );
    setMode(mode);
    requestAnimationFrame(() => {
      const current = readingKey
        ? Array.from(content?.querySelectorAll<HTMLElement>('[data-reading-anchor]') ?? []).find(
            (node) => node.dataset.readingAnchor === readingKey && node.getClientRects().length,
          )
        : anchor;
      if (content && current?.getClientRects().length)
        content.scrollTop +=
          current.getBoundingClientRect().top - content.getBoundingClientRect().top - offset;
      button.focus({ preventScroll: true });
    });
  });
}

for (const type of ['pointerdown', 'click', 'contextmenu']) {
  document.addEventListener(
    type,
    (event) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
      if (anchor) decorate(anchor);
    },
    true,
  );
}
window.addEventListener('popstate', () =>
  setMode(resolveUiMode(new URL(location.href), readPreference())),
);
window.addEventListener('pageshow', () =>
  setMode(resolveUiMode(new URL(location.href), readPreference())),
);
setMode(resolveUiMode(new URL(location.href), readPreference()));
