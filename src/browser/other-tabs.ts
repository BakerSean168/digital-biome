import { readBrowserSnapshot, withBrowserSnapshot } from '../view-models/browser-snapshot';

export function initOtherTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-other-tab]'));
  const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-other-panel]'));

  function activateOtherTab(forceActivate = false) {
    const requested = location.hash.slice(1);
    const active = panels.find((panel) => panel.id === requested)?.id ?? 'ai';
    for (const panel of panels) {
      const wasVisible = !panel.hidden;
      const shouldShow = panel.id === active;
      const browser = panel.querySelector('[data-object-browser]');
      if (wasVisible && !shouldShow) browser?.dispatchEvent(new Event('terminal-deactivate'));
      panel.hidden = !shouldShow;
      if (shouldShow && (!wasVisible || forceActivate))
        browser?.dispatchEvent(new Event('terminal-activate'));
    }
    for (const tab of tabs) {
      tab.setAttribute('aria-current', String(tab.dataset.otherTab === active));
    }
  }
  for (const tab of tabs) {
    tab.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const url = new URL(tab.href);
      for (const key of ['q', 'sort', 'facet']) url.searchParams.delete(key);
      const targetPanel = panels.find((panel) => panel.id === tab.dataset.otherTab);
      const browser = targetPanel?.querySelector<HTMLElement>('[data-object-browser]');
      let nextState: unknown = history.state;
      if (browser) {
        const key = browser.dataset.contextPath ?? location.pathname;
        const limit =
          readBrowserSnapshot(history.state, key)?.limit ??
          (browser.querySelectorAll('[data-object-row]').length || 12);
        nextState = withBrowserSnapshot(history.state, key, {
          query: '',
          facets: [],
          sort: 'default',
          limit,
        });
      }
      history.pushState(nextState, '', url);
      activateOtherTab(true);
    });
  }
  document
    .querySelector<HTMLAnchorElement>('a[href$="#terminal-main"]')
    ?.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const main = document.getElementById('terminal-main');
      if (!main) return;
      event.preventDefault();
      main.tabIndex = -1;
      main.focus();
      main.scrollIntoView({ block: 'start' });
    });

  window.addEventListener('popstate', () => activateOtherTab());
  window.addEventListener('hashchange', () => activateOtherTab());
  activateOtherTab();
}
