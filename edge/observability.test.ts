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

class MockWebSocket extends EventTarget {
  readonly url: string;
  closeCount = 0;

  constructor(url: string | URL, script: (socket: MockWebSocket) => void) {
    super();
    this.url = String(url);
    queueMicrotask(() => script(this));
  }

  emitJson(value: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) }));
  }

  emitData(value: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: value }));
  }

  emitError(): void {
    this.dispatchEvent(new Event('error'));
  }

  emitClose(): void {
    this.dispatchEvent(new Event('close'));
  }

  close(): void {
    this.closeCount += 1;
  }
}

async function withMockWebSocket(
  script: (socket: MockWebSocket) => void,
  callback: () => Promise<void>,
): Promise<void> {
  const originalWebSocket = globalThis.WebSocket;
  class TestWebSocket extends MockWebSocket {
    constructor(url: string | URL) {
      super(url, script);
    }
  }
  globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;
  try {
    await callback();
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
}

function aiPeriod(days: number, localTokens: number, hermesTokens: number, coverage?: {
  startDate: string | null;
  endDate: string | null;
  calendarDays: number;
  activeDays: number;
}) {
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
    ...(coverage ? { coverage } : {}),
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
        all: aiPeriod(192, 6000000, 3000000, {
          startDate: '2026-01-30', endDate: '2026-08-09', calendarDays: 192, activeDays: 148,
        }),
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
    assert.deepEqual(payload.periods.all.coverage, {
      startDate: '2026-01-30', endDate: '2026-08-09', calendarDays: 192, activeDays: 148,
    });
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
      all: aiPeriod(0, 0, 0, { startDate: null, endDate: null, calendarDays: 0, activeDays: 0 }),
    },
  }), async () => {
    const response = await getAiUsage({
      env: { AI_USAGE_HUB_URL: 'https://hub.example.test', AI_USAGE_HUB_READ_KEY: 'read-only-key' },
    } as any);
    assert.equal(response.status, 200);
  });
});

test('server monitoring consumes the public Nezha v2 server stream without credentials', async () => {
  await withMockWebSocket((socket) => {
    assert.equal(socket.url, 'wss://nezha.example.test/api/v1/ws/server');
    socket.emitJson({
      now: 1_789_000_000,
      online: 1,
      servers: [{
        id: 7,
        name: 'Oracle Osaka',
        country_code: 'JP',
        host: { platform: 'debian', mem_total: 1024 },
        state: { cpu: 12, mem_used: 512, net_out_speed: 1048576, net_in_speed: 2097152 },
      }],
    });
  }, async () => {
    const response = await getServers({ env: { NEZHA_BASE_URL: 'https://nezha.example.test/' } } as any);
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

test('server monitoring maps explicit null public Nezha state as offline', async () => {
  await withMockWebSocket((socket) => {
    socket.emitJson({
      now: 1_789_000_000,
      online: 0,
      servers: [{ id: 9, name: 'offline-node', host: { platform: 'ubuntu' }, state: null }],
    });
  }, async () => {
    const response = await getServers({ env: {} } as any);
    const payload = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(payload.online, 0);
    assert.equal(payload.servers[0].online, false);
  });
});

test('server monitoring accepts an ArrayBuffer public stream frame', async () => {
  await withMockWebSocket((socket) => {
    const encoded = new TextEncoder().encode(JSON.stringify({
      now: 1_789_000_000,
      online: 1,
      servers: [{
        id: 13,
        name: 'Azure-HK panel host',
        host: { platform: 'debian', mem_total: 2048 },
        state: { cpu: 4.4, mem_used: 1024, net_out_speed: 1048576, net_in_speed: 524288 },
        country_code: 'HK',
      }],
    }));
    socket.emitData(encoded.buffer);
  }, async () => {
    const response = await getServers({ env: {} } as any);
    const payload = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(payload.servers[0].location, 'HK');
    assert.equal(payload.servers[0].ram, 50);
  });
});

test('server monitoring rejects an empty public Nezha snapshot', async () => {
  await withMockWebSocket((socket) => {
    socket.emitJson({ now: 1_789_000_000, online: 0, servers: [] });
  }, async () => {
    const response = await getServers({ env: {} } as any);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Nezha telemetry is unreachable.' });
  });
});

test('server monitoring rejects telemetry without an authoritative online field', async () => {
  await withMockWebSocket((socket) => {
    socket.emitJson({ now: 1_789_000_000, online: 1, servers: [{ id: 1, name: 'Unknown state' }] });
  }, async () => {
    const response = await getServers({ env: {} } as any);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Nezha returned unsupported server telemetry.' });
  });
});

test('server monitoring fails closed when the public Nezha stream errors', async () => {
  await withMockWebSocket((socket) => {
    socket.emitError();
  }, async () => {
    const response = await getServers({ env: {} } as any);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Nezha telemetry is unreachable.' });
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
