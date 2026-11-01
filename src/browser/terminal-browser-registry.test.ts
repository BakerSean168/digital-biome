import assert from 'node:assert/strict';
import test from 'node:test';
import { createTerminalBrowserRegistry } from './terminal-browser-registry';

test('repeated initialization does not duplicate listeners or browser state', () => {
  const mounted: object[] = [];
  const disposed: object[] = [];
  const registry = createTerminalBrowserRegistry<object>((root) => {
    mounted.push(root);
    return () => disposed.push(root);
  });
  const first = {};
  const second = {};
  registry.reconcile([first, second]);
  registry.reconcile([first, second]);
  registry.reconcile([second, first]);
  assert.deepEqual(mounted, [first, second]);
  assert.deepEqual(disposed, []);
  registry.dispose();
  assert.deepEqual(disposed, [first, second]);
  registry.dispose();
  assert.equal(disposed.length, 2);
});

test('a replaced DOM root is disposed before the new instance mounts', () => {
  const events: string[] = [];
  const oldRoot = { id: 'old' };
  const freshRoot = { id: 'fresh' };
  const registry = createTerminalBrowserRegistry((root: { id: string }) => {
    events.push('mount:' + root.id);
    return () => events.push('dispose:' + root.id);
  });
  registry.reconcile([oldRoot]);
  registry.reconcile([freshRoot]);
  assert.deepEqual(events, ['mount:old', 'dispose:old', 'mount:fresh']);
});

test('multiple tools panels maintain independent owners and only remove stale panel', () => {
  const mounts = new Map<object, number>();
  const rootA = {};
  const rootB = {};
  const rootC = {};
  const registry = createTerminalBrowserRegistry<object>((root) => {
    mounts.set(root, (mounts.get(root) ?? 0) + 1);
    return () => mounts.delete(root);
  });
  registry.reconcile([rootA, rootB]);
  registry.reconcile([rootA, rootC]);
  assert.equal(mounts.get(rootA), 1);
  assert.equal(mounts.has(rootB), false);
  assert.equal(mounts.get(rootC), 1);
  registry.dispose();
  assert.equal(mounts.size, 0);
});
