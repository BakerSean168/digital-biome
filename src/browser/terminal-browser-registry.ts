/** Lifecycle registry ensures one controller per root and retires detached/replaced roots. */
export function createTerminalBrowserRegistry<Root extends object>(
  mount: (root: Root) => () => void,
) {
  const active = new Map<Root, () => void>();

  return {
    reconcile(roots: Iterable<Root>): void {
      const present = new Set(roots);
      for (const [root, dispose] of active) {
        if (present.has(root)) continue;
        active.delete(root);
        dispose();
      }
      for (const root of present) {
        if (active.has(root)) continue;
        active.set(root, mount(root));
      }
    },
    dispose(): void {
      for (const dispose of active.values()) dispose();
      active.clear();
    },
  };
}
