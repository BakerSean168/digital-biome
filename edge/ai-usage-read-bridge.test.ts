import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { calculateSummary } = require('../scripts/observability/ai-usage-read-bridge.cjs');

test('official Token Monitor history is aggregated for Local and Hermes over seven calendar days', () => {
  const summary = calculateSummary({
    savedAt: '2026-08-09T02:00:00.000Z',
    devices: {
      forest: {
        deviceId: 'forest',
        periods: { allTime: {
          totalTokens: 1100,
          costUsd: 11,
          clients: { codex: 900, workbuddy: 200 },
          clientCosts: { codex: 9, workbuddy: 2 },
          models: { 'gpt-5.6-sol': 1100 },
          modelCosts: { 'gpt-5.6-sol': 11 },
        } },
        history: { daily: [
          {
            date: '2026-08-09', tokens: 100, cost: 1,
            perClient: { codex: { tokens: 80, cost: 0.8 }, workbuddy: { tokens: 20, cost: 0.2 } },
            perModel: { 'gpt-5.6-sol': { tokens: 100, cost: 1 } },
          },
          { date: '2026-08-02', tokens: 999, cost: 9, perClient: { codex: { tokens: 999 } } },
        ] },
      },
      hermes: {
        deviceId: 'hermes',
        periods: { allTime: {
          totalTokens: 200,
          costUsd: 2,
          clients: { hermes: 200 },
          clientCosts: { hermes: 2 },
          models: { 'deepseek-v4-flash': 200 },
          modelCosts: { 'deepseek-v4-flash': 2 },
        } },
        history: { daily: [
          {
            date: '2026-08-08', tokens: 50, cost: 0.5,
            perClient: { hermes: { tokens: 50, cost: 0.5 } },
            perModel: { 'deepseek-v4-flash': { tokens: 50, cost: 0.5 } },
          },
        ] },
      },
    },
  }, new Date('2026-08-09T12:00:00+08:00'));

  assert.equal(summary.totalTokens7d, 150);
  assert.equal(summary.estimatedCost7d, 1.5);
  assert.deepEqual(summary.byMachine, {
    local: { tokens7d: 100, costUsd7d: 1, pct: 66.7 },
    hermes: { tokens7d: 50, costUsd7d: 0.5, pct: 33.3 },
  });
  assert.deepEqual(summary.tools.map((tool: any) => [tool.name, tool.tokens7d]), [
    ['Codex', 80],
    ['Hermes Agent', 50],
    ['WorkBuddy', 20],
  ]);
  assert.deepEqual(summary.periods['7d'].machines.local.agents.map((item: any) => [item.name, item.tokens, item.costUsd]), [
    ['Codex', 80, 0.8],
    ['WorkBuddy', 20, 0.2],
  ]);
  assert.deepEqual(summary.periods['7d'].machines.hermes.models.map((item: any) => [item.name, item.tokens]), [
    ['deepseek-v4-flash', 50],
  ]);
  assert.equal(summary.periods['1d'].machines.hermes.tokens, 0);
  assert.equal(summary.periods['30d'].totalTokens, 1149);
  assert.equal(summary.periods.all.totalTokens, 1300);
  assert.equal(summary.periods.all.totalCostUsd, 13);
  assert.deepEqual(summary.periods.all.coverage, {
    startDate: '2026-08-02',
    endDate: '2026-08-09',
    calendarDays: 8,
    activeDays: 3,
  });
  assert.deepEqual(summary.periods.all.machines.local.agents.map((item: any) => [item.name, item.tokens, item.costUsd]), [
    ['Codex', 900, 9],
    ['WorkBuddy', 200, 2],
  ]);
  assert.deepEqual(summary.periods.all.machines.hermes.models.map((item: any) => [item.name, item.tokens, item.costUsd]), [
    ['deepseek-v4-flash', 200, 2],
  ]);
});
