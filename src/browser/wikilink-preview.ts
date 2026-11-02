/**
 * Hover preview card for resolved wikilinks.
 *
 * Title and excerpt are emitted at build time by `remark-wikilinks` as
 * `data-preview-title` / `data-preview-excerpt`, so hovering never fetches the target note.
 * One delegated listener pair covers every link, including ones rendered later.
 */

const SHOW_DELAY_MS = 180;
const HIDE_DELAY_MS = 200;
const MIN_VIEWPORT_WIDTH = 768;
const CARD_MAX_HEIGHT = 220;
const CARD_WIDTH = 330;
const VIEWPORT_MARGIN = 10;

function wikilinkFrom(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest<HTMLAnchorElement>('a.wikilink') : null;
}

export function initWikilinkPreview(): void {
  const card = document.getElementById('wikilink-preview-card');
  const title = document.getElementById('wikilink-preview-title');
  const excerpt = document.getElementById('wikilink-preview-desc');
  if (!card || !title || !excerpt) return;

  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const show = (link: HTMLAnchorElement) => {
    title.textContent = link.dataset.previewTitle ?? link.textContent?.trim() ?? '';
    excerpt.textContent = link.dataset.previewExcerpt ?? '';
    excerpt.hidden = !link.dataset.previewExcerpt;

    const rect = link.getBoundingClientRect();
    card.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - CARD_MAX_HEIGHT)}px`;
    card.style.left = `${Math.max(VIEWPORT_MARGIN, Math.min(window.innerWidth - CARD_WIDTH, rect.left - 40))}px`;
    card.classList.remove('hidden');
    // Force a reflow so the opacity transition runs after un-hiding.
    void card.offsetWidth;
    card.classList.replace('opacity-0', 'opacity-100');
  };

  const hide = () => {
    card.classList.replace('opacity-100', 'opacity-0');
    hideTimer = setTimeout(() => card.classList.add('hidden'), HIDE_DELAY_MS);
  };

  document.addEventListener('mouseover', (event) => {
    const link = wikilinkFrom(event.target);
    if (!link || link.contains(event.relatedTarget as Node | null)) return;
    if (window.innerWidth < MIN_VIEWPORT_WIDTH) return;
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    showTimer = setTimeout(() => show(link), SHOW_DELAY_MS);
  });

  document.addEventListener('mouseout', (event) => {
    const link = wikilinkFrom(event.target);
    if (!link || link.contains(event.relatedTarget as Node | null)) return;
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, HIDE_DELAY_MS);
  });

  document.getElementById('site-content')?.addEventListener(
    'scroll',
    () => {
      clearTimeout(showTimer);
      hide();
    },
    { passive: true },
  );
}
