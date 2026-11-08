import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SERVICE_LIFECYCLE_FILTERS,
  matchesServiceLifecycle,
  serviceLifecycleGroup,
  serviceLifecycleLabel,
} from './service-lifecycle';

test('lifecycle filter defaults to active and supports three phases plus all', () => {
  assert.deepEqual(
    SERVICE_LIFECYCLE_FILTERS.map((option) => option.id),
    ['active', 'planned', 'retired', 'all'],
  );
  assert.deepEqual(
    [
      serviceLifecycleGroup('active'),
      serviceLifecycleGroup('planned'),
      serviceLifecycleGroup('retired'),
      serviceLifecycleGroup('archived'),
      serviceLifecycleGroup('decommissioning'),
    ],
    ['active', 'planned', 'retired', 'retired', 'retired'],
  );
});

test('filter counts are derived from resource status rather than external health', () => {
  const statuses = ['active', 'planned', 'retired', 'archived', 'decommissioning'] as const;
  assert.equal(statuses.filter((status) => matchesServiceLifecycle(status, 'active')).length, 1);
  assert.equal(statuses.filter((status) => matchesServiceLifecycle(status, 'planned')).length, 1);
  assert.equal(statuses.filter((status) => matchesServiceLifecycle(status, 'retired')).length, 3);
  assert.equal(statuses.filter((status) => matchesServiceLifecycle(status, 'all')).length, 5);
  assert.deepEqual(
    statuses.map((status) => serviceLifecycleLabel(status)),
    ['运行中', '规划中', '已退役', '已归档', '退役中'],
  );
});
