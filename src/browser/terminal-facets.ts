import { facetOptions, type FacetOption } from '../view-models/terminal-filters';
import type { TerminalObject } from '../view-models/terminal-object';
export function initializeFacets(
  root: HTMLElement,
  getItems: () => TerminalObject[],
  load: () => Promise<void>,
  apply: () => void,
) {
  const trigger = root.querySelector<HTMLButtonElement>('[data-facet-trigger]');
  if (trigger)
    root.insertAdjacentHTML(
      'beforeend',
      `    <dialog
        data-facet-dialog
        aria-label="筛选"
        class="m-auto max-h-[85dvh] w-[960px] max-w-[calc(100vw-2rem)] overflow-auto border border-border bg-background p-4 text-sm text-foreground backdrop:bg-black/75 md:p-5"
      >
        <h2 class="mb-4 text-primary">
          筛选 · <span data-facet-count></span>
        </h2>
        <div
          data-facet-options
          class="grid max-h-[55dvh] grid-cols-1 gap-5 overflow-auto sm:grid-cols-2 lg:grid-cols-3"
        ></div>
        <footer class="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
          <p data-ui-only="tui" class="text-xs text-muted-foreground">
            j/k 移动 · h/l 换组 · Space 选择 · a 整组 · 0 清空
          </p>
          <div class="flex gap-4">
            <button data-facet-cancel type="button">
              取消
            </button>
            <button data-facet-apply type="button" class="bg-primary px-3 py-1 text-background">
              确认
            </button>
          </div>
        </footer>
      </dialog>`,
    );
  const dialog = root.querySelector<HTMLDialogElement>('[data-facet-dialog]');
  const body = root.querySelector<HTMLElement>('[data-facet-options]');
  const chips = root.querySelector<HTMLElement>('[data-facet-chips]');
  let selected = new Set<string>(),
    draft = new Set<string>(),
    options: FacetOption[] = [];
  let cursor = 0;
  const buttons: HTMLButtonElement[] = [];
  const sync = () => {
    buttons.forEach((button, i) => {
      const prefix =
        document.documentElement.dataset.ui === 'gui'
          ? ''
          : `[${draft.has(options[i].key) ? 'x' : ' '}] `;
      button.textContent = `${prefix}${options[i].value}  ${options[i].count}`;
      button.setAttribute('aria-pressed', String(draft.has(options[i].key)));
    });
    const count = dialog?.querySelector('[data-facet-count]');
    if (count) count.textContent = `已选 ${draft.size} / ${options.length}`;
  };
  const paintChips = () => {
    chips?.replaceChildren();
    for (const option of options)
      if (selected.has(option.key)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'border border-primary px-2 text-primary';
        b.textContent = option.value + ' ×';
        b.title = option.group + ' / ' + option.value;
        b.onclick = () => {
          selected.delete(option.key);
          paintChips();
          apply();
        };
        chips?.append(b);
      }
    if (selected.size) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = '清除筛选';
      b.onclick = () => {
        selected.clear();
        paintChips();
        apply();
      };
      chips?.append(b);
    }
  };
  const commit = () => {
    selected = new Set(draft);
    paintChips();
    dialog?.close();
    apply();
  };
  trigger?.addEventListener('click', async () => {
    trigger.disabled = true;
    await load();
    trigger.disabled = false;
    if (!root.querySelector('[data-object-error]')?.classList.contains('hidden')) return;
    options = facetOptions(getItems());
    draft = new Set(selected);
    cursor = 0;
    buttons.length = 0;
    body?.replaceChildren();
    const groups = new Map<string, HTMLElement>();
    options.forEach((option, i) => {
      // Tags share OR semantics, while visual columns follow the first tag segment.
      const groupLabel = option.group === '标签' ? option.value.split('/')[0] : option.group;
      let group = groups.get(groupLabel);
      if (!group) {
        group = document.createElement('section');
        const h = document.createElement('h3');
        h.className = 'mb-2 text-xs text-muted-foreground';
        h.textContent = groupLabel;
        group.append(h);
        groups.set(groupLabel, group);
        body?.append(group);
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className =
        'block w-full border border-transparent px-2 py-1 text-left break-words focus:border-primary focus:bg-card focus:outline-none';
      b.onfocus = () => {
        cursor = i;
      };
      b.onclick = () => {
        draft.has(option.key) ? draft.delete(option.key) : draft.add(option.key);
        sync();
      };
      group.append(b);
      buttons.push(b);
    });
    if (!options.length && body) body.textContent = '暂无可用的筛选条件。';
    sync();
    dialog?.showModal();
    buttons[0]?.focus();
  });
  dialog?.querySelector('[data-facet-apply]')?.addEventListener('click', commit);
  dialog?.querySelector('[data-facet-cancel]')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (document.documentElement.dataset.shortcuts === 'off' && key.length === 1) return;
    if (key === 'Enter' && !(event.target as Element).closest('[data-facet-cancel]')) {
      event.preventDefault();
      commit();
      return;
    }
    if (!buttons.length) return;
    if (
      ['j', 'k', 'ArrowDown', 'ArrowUp', 'h', 'l', 'ArrowLeft', 'ArrowRight', 'a', '0'].includes(
        key,
      )
    ) {
      event.preventDefault();
      if (['j', 'ArrowDown'].includes(key)) cursor = Math.min(buttons.length - 1, cursor + 1);
      if (['k', 'ArrowUp'].includes(key)) cursor = Math.max(0, cursor - 1);
      const group =
        options[cursor].group === '标签'
          ? options[cursor].value.split('/')[0]
          : options[cursor].group;
      const visual = (o: FacetOption) => (o.group === '标签' ? o.value.split('/')[0] : o.group);
      if (['h', 'l', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        const groups = [...new Set(options.map(visual))];
        const next = groups[groups.indexOf(group) + (['l', 'ArrowRight'].includes(key) ? 1 : -1)];
        const index = options.findIndex((o) => visual(o) === next);
        if (index >= 0) cursor = index;
      }
      if (key === 'a') {
        const current = options.filter((o) => visual(o) === group);
        const all = current.every((o) => draft.has(o.key));
        current.forEach((o) => {
          if (all) draft.delete(o.key);
          else draft.add(o.key);
        });
      }
      if (key === '0') draft.clear();
      sync();
      buttons[cursor]?.focus();
    }
  });
  root.addEventListener('terminal-clear', () => {
    selected.clear();
    paintChips();
    apply();
  });
  return {
    selected: () => selected,
    options: () => facetOptions(getItems()),
    restore: (keys: string[]) => {
      options = facetOptions(getItems());
      const valid = new Set(options.map((option) => option.key));
      selected = new Set(keys.filter((key) => valid.has(key)));
      paintChips();
    },
  };
}
