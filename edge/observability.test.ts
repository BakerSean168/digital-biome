import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest as getServers } from '../functions/api/servers';
import { onRequest as getVisitorIp } from '../functions/api/visitor-ip';

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

test('server monitoring consumes the public Nezha v2 server stream without credentials', async () => {
  await withMockWebSocket(
    (socket) => {
      assert.equal(socket.url, 'wss://nezha.example.test/api/v1/ws/server');
      socket.emitJson({
        now: 1_789_000_000,
        online: 1,
        servers: [
          {
            id: 7,
            name: 'Oracle Osaka',
            country_code: 'JP',
            host: { platform: 'debian', mem_total: 1024 },
            state: { cpu: 12, mem_used: 512, net_out_speed: 1048576, net_in_speed: 2097152 },
          },
        ],
      });
    },
    async () => {
      const response = await getServers({
        env: { NEZHA_BASE_URL: 'https://nezha.example.test/' },
      } as any);
      const payload = (await response.json()) as any;
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
    },
  );
});

test('server monitoring maps explicit null public Nezha state as offline', async () => {
  await withMockWebSocket(
    (socket) => {
      socket.emitJson({
        now: 1_789_000_000,
        online: 0,
        servers: [{ id: 9, name: 'offline-node', host: { platform: 'ubuntu' }, state: null }],
      });
    },
    async () => {
      const response = await getServers({
        env: { NEZHA_BASE_URL: 'https://nezha.example.test/' },
      } as any);
      const payload = (await response.json()) as any;
      assert.equal(response.status, 200);
      assert.equal(payload.online, 0);
      assert.equal(payload.servers[0].online, false);
    },
  );
});

test('server monitoring accepts an ArrayBuffer public stream frame', async () => {
  await withMockWebSocket(
    (socket) => {
      const encoded = new TextEncoder().encode(
        JSON.stringify({
          now: 1_789_000_000,
          online: 1,
          servers: [
            {
              id: 13,
              name: 'Azure-HK panel host',
              host: { platform: 'debian', mem_total: 2048 },
              state: { cpu: 4.4, mem_used: 1024, net_out_speed: 1048576, net_in_speed: 524288 },
              country_code: 'HK',
            },
          ],
        }),
      );
      socket.emitData(encoded.buffer);
    },
    async () => {
      const response = await getServers({
        env: { NEZHA_BASE_URL: 'https://nezha.example.test/' },
      } as any);
      const payload = (await response.json()) as any;
      assert.equal(response.status, 200);
      assert.equal(payload.servers[0].location, 'HK');
      assert.equal(payload.servers[0].ram, 50);
    },
  );
});

test('server monitoring rejects an empty public Nezha snapshot', async () => {
  await withMockWebSocket(
    (socket) => {
      socket.emitJson({ now: 1_789_000_000, online: 0, servers: [] });
    },
    async () => {
      const response = await getServers({
        env: { NEZHA_BASE_URL: 'https://nezha.example.test/' },
      } as any);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { error: 'Nezha telemetry is unreachable.' });
    },
  );
});

test('server monitoring rejects telemetry without an authoritative online field', async () => {
  await withMockWebSocket(
    (socket) => {
      socket.emitJson({
        now: 1_789_000_000,
        online: 1,
        servers: [{ id: 1, name: 'Unknown state' }],
      });
    },
    async () => {
      const response = await getServers({
        env: { NEZHA_BASE_URL: 'https://nezha.example.test/' },
      } as any);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), {
        error: 'Nezha returned unsupported server telemetry.',
      });
    },
  );
});

test('server monitoring fails closed when the public Nezha stream errors', async () => {
  await withMockWebSocket(
    (socket) => {
      socket.emitError();
    },
    async () => {
      const response = await getServers({
        env: { NEZHA_BASE_URL: 'https://nezha.example.test/' },
      } as any);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { error: 'Nezha telemetry is unreachable.' });
    },
  );
});

test('visitor telemetry uses an explicit local fallback without inventing a public identity', async () => {
  const response = await getVisitorIp({
    env: {},
    request: new Request('http://localhost/api/visitor-ip'),
  } as any);
  const payload = (await response.json()) as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(payload.ip, '127.0.*.*');
  assert.ok(!('rawIp' in payload), 'The public response must not expose the unmasked address.');
  assert.equal(payload.city, 'Local');
  assert.equal(payload.asn, 'AS--');
});

test('server monitoring reports a suspended state when Nezha is not configured', async () => {
  let socketConstructed = false;
  await withMockWebSocket(
    () => {
      socketConstructed = true;
    },
    async () => {
      const response = await getServers({ env: {} } as any);
      const payload = (await response.json()) as any;
      assert.equal(response.status, 200);
      assert.equal(payload.status, 'suspended');
      assert.equal(payload.total, 0);
      assert.equal(payload.online, 0);
      assert.deepEqual(payload.servers, []);
    },
  );
  assert.equal(socketConstructed, false);
});
