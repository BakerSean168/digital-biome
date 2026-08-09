import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest as getAiUsage } from '../functions/api/ai-usage';
import { onRequest as getServers } from '../functions/api/servers';
import { onRequest as getVisitorIp } from '../functions/api/visitor-ip';

async function withMockFetch(
  handler: typeof fetch,
  callback: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function aiPeriod(days: number, localTokens: number, hermesTokens: number) {
  const totalTokens = localTokens + hermesTokens;
  const machine = (id: 'local' | 'hermes', tokens: number) => ({
    id,
    name: id,
    tokens,
    costUsd: 0,
    sharePct: totalTokens > 0 ? (tokens / totalTokens) * 100 : 0,
    agents: [],
    models: [],
  });
  return {
    days,
    totalTokens,
    totalCostUsd: 0,
    totalCostRmb: 0,
    machines: {
      local: machine('local', localTokens),
      hermes: machine('hermes', hermesTokens),
    },
  };
}

test('AI usage reports missing configuration instead of returning sample telemetry', async () => {
  const response = await getAiUsage({ env: {} } as any);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'AI usage telemetry is not configured.' });
});

test('server monitoring reports missing credentials instead of marking sample hosts online', async () => {
  const response = await getServers({ env: {} } as any);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Server telemetry is not configured.' });
});

test('AI usage maps the current seven-day Hub contract with the read-only key', async () => {
  await withMockFetch(async (_input, init) => {
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer read-only-key');
    return Response.json({
      totalTokens7d: 816100,
      estimatedCost7d: 1.63,
      estimatedCostRmb7d: 11.13,
      updatedAt: '2026-08-08T14:25:00.000Z',
      tools: [{ id: 'codex', name: 'Codex', vendor: 'openai', tokens7d: 650400, sharePct: 79.7 }],
      byMachine: {
        local: { tokens7d: 700000, costUsd7d: 1.2, pct: 85.8 },
        hermes: { tokens7d: 116100, costUsd7d: 0.43, pct: 14.2 },
      },
      source: 'official-token-monitor',
      deviceCount: 2,
      periods: {
        '1d': aiPeriod(1, 100, 20),
        '7d': aiPeriod(7, 700000, 116100),
        '30d': aiPeriod(30, 900000, 200000),
      },
    });
  }, async () => {
    const response = await getAiUsage({
      env: { AI_USAGE_HUB_URL: 'https://hub.example.test/', AI_USAGE_HUB_READ_KEY: 'read-only-key' },
    } as any);
    const payload = await response.json() as any;

    assert.equal(response.status, 200);
    assert.equal(payload.totalTokens7d, 816100);
    assert.equal(payload.tools[0].tokens7d, 650400);
    assert.deepEqual(payload.byMachine.hermes, { tokens7d: 116100, costUsd7d: 0.43, pct: 14.2 });
    assert.equal(payload.periods['30d'].machines.local.tokens, 900000);
  });
});

test('AI usage never promotes monthly or lifetime totals to seven-day usage', async () => {
  await withMockFetch(async () => Response.json({
    todayTokens: 20,
    monthlyTokens: 9000,
    totalTokens: 100000,
    models: [{ name: 'legacy-model', tokens: 100000 }],
  }), async () => {
    const response = await getAiUsage({
      env: { AI_USAGE_HUB_URL: 'https://hub.example.test', AI_USAGE_HUB_READ_KEY: 'read-only-key' },
    } as any);

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'AI usage hub returned an unsupported payload.' });
  });
});

test('AI usage reports upstream authentication rejection', async () => {
  await withMockFetch(async () => Response.json({ error: 'unauthorized' }, { status: 401 }), async () => {
    const response = await getAiUsage({
      env: { AI_USAGE_HUB_URL: 'https://hub.example.test', AI_USAGE_HUB_READ_KEY: 'wrong-key' },
    } as any);
    assert.equal(response.status, 502);
  });
});

test('AI usage accepts an empty current-contract ledger', async () => {
  await withMockFetch(async () => Response.json({
    totalTokens7d: 0,
    estimatedCost7d: 0,
    estimatedCostRmb7d: 0,
    updatedAt: '2026-08-09T00:00:00.000Z',
    tools: [],
    byMachine: {
      local: { tokens7d: 0, costUsd7d: 0, pct: 0 },
      hermes: { tokens7d: 0, costUsd7d: 0, pct: 0 },
    },
    source: 'official-token-monitor',
    deviceCount: 2,
    periods: {
      '1d': aiPeriod(1, 0, 0),
      '7d': aiPeriod(7, 0, 0),
      '30d': aiPeriod(30, 0, 0),
    },
  }), async () => {
    const response = await getAiUsage({
      env: { AI_USAGE_HUB_URL: 'https://hub.example.test', AI_USAGE_HUB_READ_KEY: 'read-only-key' },
    } as any);
    assert.equal(response.status, 200);
  });
});

test('server monitoring maps a successful Nezha response with authoritative online state', async () => {
  await withMockFetch(async (_input, init) => {
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer scoped-pat');
    return Response.json({
      success: true,
      data: [{
        id: 7,
        name: 'Oracle Osaka',
        country_code: 'JP',
        host: { platform: 'debian' },
        status: { online: true, cpu: 12, mem_used: 512, mem_total: 1024, net_out_speed: 1048576, net_in_speed: 2097152 },
      }],
    });
  }, async () => {
    const response = await getServers({ env: { NEZHA_PAT: 'scoped-pat' } } as any);
    const payload = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(payload.online, 1);
    assert.deepEqual(payload.servers[0], {
      id: 7,
      name: 'Oracle Osaka',
      location: 'JP',
      provider: 'debian',
      online: true,
      cpu: 12,
      ram: 50,
      upSpeed: '1.0 Mbps',
      downSpeed: '2.0 Mbps',
    });
  });
});

test('server monitoring maps the live Nezha state and host payload', async () => {
  await withMockFetch(async () => Response.json({
    success: true,
    data: [{
      id: 13,
      name: 'Azure-HK panel host',
      host: { platform: 'debian', mem_total: 2048 },
      state: { cpu: 4.4, mem_used: 1024, net_out_speed: 1048576, net_in_speed: 524288 },
      geoip: { country_code: 'HK' },
      last_active: '2026-08-09T02:10:53.101565878Z',
    }],
  }), async () => {
    const response = await getServers({ env: { NEZHA_PAT: 'scoped-pat' } } as any);
    const payload = await response.json() as any;

    assert.equal(response.status, 200);
    assert.equal(payload.online, 1);
    assert.deepEqual(payload.servers[0], {
      id: 13,
      name: 'Azure-HK panel host',
      location: 'HK',
      provider: 'debian',
      online: true,
      cpu: 4,
      ram: 50,
      upSpeed: '1.0 Mbps',
      downSpeed: '0.5 Mbps',
    });
  });
});

test('server monitoring treats an explicit null Nezha state as offline', async () => {
  await withMockFetch(async () => Response.json({
    success: true,
    data: [{ id: 9, name: 'offline-node', host: { platform: 'ubuntu' }, state: null }],
  }), async () => {
    const response = await getServers({ env: { NEZHA_PAT: 'scoped-pat' } } as any);
    const payload = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(payload.online, 0);
    assert.equal(payload.servers[0].online, false);
  });
});

test('server monitoring rejects an HTTP 200 Nezha business error', async () => {
  await withMockFetch(async () => Response.json({ error: 'ApiErrorUnauthorized' }), async () => {
    const response = await getServers({ env: { NEZHA_PAT: 'invalid-pat' } } as any);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Nezha rejected the request.' });
  });
});

test('server monitoring rejects telemetry without an authoritative online field', async () => {
  await withMockFetch(async () => Response.json({ success: true, data: [{ id: 1, name: 'Unknown state' }] }), async () => {
    const response = await getServers({ env: { NEZHA_PAT: 'scoped-pat' } } as any);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Nezha returned unsupported server telemetry.' });
  });
});

test('visitor telemetry uses an explicit local fallback without inventing a public identity', async () => {
  const response = await getVisitorIp({
    env: {},
    request: new Request('http://localhost/api/visitor-ip'),
  } as any);
  const payload = await response.json() as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(payload.ip, '127.0.*.*');
  assert.ok(!('rawIp' in payload), 'The public response must not expose the unmasked address.');
  assert.equal(payload.city, 'Local');
  assert.equal(payload.asn, 'AS--');
});
