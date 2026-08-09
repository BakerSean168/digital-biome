import assert from 'node:assert/strict';
import test from 'node:test';
import { monthlyEquivalentCost } from './subscriptions';

test('monthly subscriptions retain their monthly cost', () => {
  assert.equal(monthlyEquivalentCost({ cost: 8.13, cycle: 'monthly' }), 8.13);
});

test('yearly subscriptions are prorated over twelve months', () => {
  assert.equal(monthlyEquivalentCost({ cost: 39, cycle: 'yearly' }), 3.25);
});

test('converted annual cost is prorated when supplied', () => {
  assert.equal(monthlyEquivalentCost({ cost: 5.71, annualCost: 5.71, cycle: 'yearly' }), 5.71 / 12);
});
