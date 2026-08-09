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
  NEZHA_PAT?: string;
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

export const onRequest: PagesFunction<ObservabilityEnv> = async (context) => {
  const nezhaUrl = context.env.NEZHA_BASE_URL || 'https://nezha.bakersean.top';
  const nezhaPat = context.env.NEZHA_PAT;

  if (!nezhaUrl || !nezhaPat) {
    return Response.json({ error: 'Server telemetry is not configured.' }, { status: 503 });
  }

  try {
    const response = await fetch(`${nezhaUrl.replace(/\/$/, '')}/api/v1/server`, {
      headers: {
        'Authorization': `Bearer ${nezhaPat.replace(/^Bearer\s+/i, '')}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return Response.json({ error: 'Nezha rejected the request.' }, { status: 502 });
    }

    const body = await response.json() as unknown;
    if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) {
      return Response.json({ error: 'Nezha rejected the request.' }, { status: 502 });
    }
    if (body.data.length === 0) {
      return Response.json({ error: 'Nezha returned no server telemetry.' }, { status: 502 });
    }

    const mappedServers = body.data.map(mapServer);
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

    return Response.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=10, s-maxage=15',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return Response.json({ error: 'Nezha telemetry is unreachable.' }, { status: 502 });
  }
};
