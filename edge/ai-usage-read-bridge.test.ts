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
        history: { daily: [
          { date: '2026-08-09', tokens: 100, cost: 1, perClient: { codex: { tokens: 100 } } },
          { date: '2026-08-02', tokens: 999, cost: 9, perClient: { codex: { tokens: 999 } } },
        ] },
      },
      hermes: {
        deviceId: 'hermes',
        history: { daily: [
          { date: '2026-08-08', tokens: 50, cost: 0.5, perClient: { hermes: { tokens: 50 } } },
        ] },
      },
    },
  }, new Date('2026-08-09T12:00:00+08:00'));

  assert.equal(summary.totalTokens7d, 150);
  assert.equal(summary.estimatedCost7d, 1.5);
  assert.deepEqual(summary.byMachine, {
    local: { tokens7d: 100, pct: 66.7 },
    hermes: { tokens7d: 50, pct: 33.3 },
  });
  assert.deepEqual(summary.tools.map((tool: any) => [tool.name, tool.tokens7d]), [
    ['Codex', 100],
    ['Hermes Agent', 50],
  ]);
});
