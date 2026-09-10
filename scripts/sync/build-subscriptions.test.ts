import assert from 'node:assert/strict';
import test from 'node:test';
import { projectSubscriptionFrontmatter } from './build-subscriptions';

test('subscription projection reuses full YAML semantics for typed scalars', () => {
  const data = projectSubscriptionFrontmatter(`---
asset_id: subscription-example
name: "Example: Pro"
vendor: Example
cost: 12.50
currency: AUD
exchangeRateUsd: 0.65
cycle: monthly
notes: >-
  preserves a YAML block scalar
---
body
`);

  assert.deepEqual(data, {
    asset_id: 'subscription-example',
    id: undefined,
    name: 'Example: Pro',
    vendor: 'Example',
    cost: 12.5,
    currency: 'AUD',
    exchangeRateUsd: 0.65,
    cycle: 'monthly',
    annualCost: undefined,
    nextBillingDate: undefined,
    status: undefined,
    icon: undefined,
    notes: 'preserves a YAML block scalar',
  });
});
