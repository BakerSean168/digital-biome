import assert from 'node:assert/strict';
import test from 'node:test';
import { getSystemQuickAccess, publicSystemFactCounts } from './personal-systems';

test('Personal Systems keeps the landing surface curated', () => {
  const quickAccess = getSystemQuickAccess();
  assert.ok(quickAccess.length <= 5);
  assert.deepEqual(
    quickAccess.map((item) => item.resource.id),
    [
      'svc-nezha-panel',
      'svc-memoflow-dailyuse',
      'svc-homepage-dashboard',
      'svc-pve-panel',
      'svc-sub-store',
    ].filter((id) => quickAccess.some((item) => item.resource.id === id)),
  );
});

test('Personal Systems reports the active public cloud fleet, not every active host', () => {
  const facts = publicSystemFactCounts();
  assert.ok(facts.domainCount > 0);
  assert.equal(facts.cloudHostCount, 4);
});
