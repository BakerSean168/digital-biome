export interface ServerItem {
  id: number;
  name: string;
  location: string;
  provider: string;
  online: boolean;
  cpu: number;
  ram: number;
  upSpeed: string;
  downSpeed: string;
}

export interface ServerMonitorResponse {
  total: number;
  online: number;
  status: 'all_normal' | 'degraded' | 'critical';
  updatedAt: string;
  servers: ServerItem[];
}

export interface ObservabilityEnv extends Env {
  NEZHA_BASE_URL?: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mapServer(value: unknown, index: number): ServerItem | null {
  if (!isRecord(value)) return null;
  const legacyStatus = isRecord(value.status) ? value.status : null;
  const liveState = isRecord(value.state) ? value.state : null;
  const telemetry = legacyStatus ?? liveState;
  const host = isRecord(value.host) ? value.host : null;
  const geoip = isRecord(value.geoip) ? value.geoip : null;
  const hasStateField = Object.prototype.hasOwnProperty.call(value, 'state');
  const online = legacyStatus && typeof legacyStatus.online === 'boolean'
    ? legacyStatus.online
    : typeof value.online === 'boolean'
      ? value.online
      : hasStateField
        ? liveState !== null
        : null;
  if (online === null) return null;

  const memUsed = telemetry ? numberOrZero(telemetry.mem_used) : 0;
  const memTotal = telemetry
    ? numberOrZero(telemetry.mem_total) || (host ? numberOrZero(host.mem_total) : 0)
    : 0;
  const id = typeof value.id === 'number' ? value.id : index + 1;

  return {
    id,
    name: typeof value.name === 'string'
      ? value.name
      : host && typeof host.name === 'string'
        ? host.name
        : `Server #${id}`,
    location: geoip && typeof geoip.country_code === 'string'
      ? geoip.country_code
      : typeof value.country_code === 'string'
      ? value.country_code
      : typeof value.location === 'string'
        ? value.location
        : 'Global',
    provider: host && typeof host.platform === 'string'
      ? host.platform
      : typeof value.platform === 'string'
        ? value.platform
        : 'VPS',
    online,
    cpu: Math.round(telemetry ? numberOrZero(telemetry.cpu) : numberOrZero(value.cpu)),
    ram: Math.round(memTotal > 0 ? (memUsed / memTotal) * 100 : numberOrZero(value.ram)),
    upSpeed: `${((telemetry ? numberOrZero(telemetry.net_out_speed) : numberOrZero(value.up_speed)) / 1024 / 1024).toFixed(1)} Mbps`,
    downSpeed: `${((telemetry ? numberOrZero(telemetry.net_in_speed) : numberOrZero(value.down_speed)) / 1024 / 1024).toFixed(1)} Mbps`,
  };
}

type NezhaPublicSnapshot = {
  servers: unknown[];
};

function parsePublicSnapshot(value: unknown): NezhaPublicSnapshot {
  if (!isRecord(value) || !Array.isArray(value.servers) || value.servers.length === 0) {
    throw new Error('Nezha returned no public server telemetry.');
  }
  return { servers: value.servers };
}

function readWebSocketMessage(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }
  throw new Error('Nezha returned an unsupported WebSocket message.');
}

async function readNezhaPublicSnapshot(
  baseUrl: string,
  timeoutMs = 5_000,
): Promise<NezhaPublicSnapshot> {
  const streamUrl = new URL('/api/v1/ws/server', baseUrl);
  streamUrl.protocol = streamUrl.protocol === 'http:' ? 'ws:' : 'wss:';

  return await new Promise<NezhaPublicSnapshot>((resolve, reject) => {
    const socket = new WebSocket(streamUrl.toString());
    let settled = false;

    const onMessage = (event: MessageEvent) => {
      try {
        const body = JSON.parse(readWebSocketMessage(event.data)) as unknown;
        finish({ value: parsePublicSnapshot(body) });
      } catch (error) {
        finish({ error: error instanceof Error ? error : new Error('Invalid Nezha snapshot.') });
      }
    };
    const onError = () => {
      finish({ error: new Error('Nezha public server stream is unreachable.') });
    };
    const onClose = () => {
      if (!settled) finish({ error: new Error('Nezha public server stream closed early.') });
    };

    const finish = (result: { value: NezhaPublicSnapshot } | { error: Error }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('close', onClose);
      try {
        socket.close(1000, 'snapshot received');
      } catch {
        // Closing is best-effort after the first snapshot or a connection failure.
      }
      if ('value' in result) resolve(result.value);
      else reject(result.error);
    };

    const timer = setTimeout(() => {
      finish({ error: new Error('Nezha public server stream timed out.') });
    }, timeoutMs);

    socket.addEventListener('message', onMessage);
    socket.addEventListener('error', onError);
    socket.addEventListener('close', onClose);
  });
}

async function readCachedResponse(request: Request): Promise<Response | null> {
  if (request.method !== 'GET') return null;
  const edgeCache = (caches as unknown as { default: Cache }).default;
  return (await edgeCache.match(new Request(request.url, { method: 'GET' }))) ?? null;
}

function cacheResponse(context: EventContext<ObservabilityEnv, string, unknown>, response: Response): void {
  if (context.request.method !== 'GET') return;
  const key = new Request(context.request.url, { method: 'GET' });
  const edgeCache = (caches as unknown as { default: Cache }).default;
  context.waitUntil(edgeCache.put(key, response.clone()));
}

export const onRequest: PagesFunction<ObservabilityEnv> = async (context) => {
  const cached = context.request ? await readCachedResponse(context.request) : null;
  if (cached) return cached;

  const nezhaUrl = context.env.NEZHA_BASE_URL || 'https://nezha.bakersean.top';

  try {
    const snapshot = await readNezhaPublicSnapshot(nezhaUrl);
    const mappedServers = snapshot.servers.map(mapServer);
    if (mappedServers.some((server) => server === null)) {
      return Response.json({ error: 'Nezha returned unsupported server telemetry.' }, { status: 502 });
    }
    const servers = mappedServers as ServerItem[];
    const online = servers.filter((server) => server.online).length;

    const payload: ServerMonitorResponse = {
      total: servers.length,
      online,
      status: online === servers.length ? 'all_normal' : online > 0 ? 'degraded' : 'critical',
      updatedAt: new Date().toISOString(),
      servers,
    };

    const response = Response.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=10, s-maxage=30',
        'Access-Control-Allow-Origin': '*',
      },
    });
    if (context.request) cacheResponse(context, response);
    return response;
  } catch {
    return Response.json({ error: 'Nezha telemetry is unreachable.' }, { status: 502 });
  }
};
