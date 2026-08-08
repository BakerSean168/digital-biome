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

export const onRequest: PagesFunction<ObservabilityEnv> = async (context) => {
  const nezhaUrl = context.env.NEZHA_BASE_URL || 'https://nezha.bakersean.top';
  const nezhaPat = context.env.NEZHA_PAT;

  if (!nezhaUrl || !nezhaPat) {
    return Response.json({ error: 'Server telemetry is not configured.' }, { status: 503 });
  }

  let servers: ServerItem[] = [];

  if (nezhaUrl && nezhaPat) {
    try {
      const authHeader = nezhaPat.startsWith('Bearer ') ? nezhaPat : `Bearer ${nezhaPat}`;
      
      // Try Nezha v2 endpoint first, then v1 details
      let response = await fetch(`${nezhaUrl.replace(/\/$/, '')}/api/v1/server`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        response = await fetch(`${nezhaUrl.replace(/\/$/, '')}/api/v1/server/details`, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
          },
        });
      }

      if (response.ok) {
        const data = (await response.json()) as any;
        const rawList = Array.isArray(data?.result) ? data.result : Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : null;

        if (rawList && rawList.length > 0) {
          servers = rawList.map((s: any, idx: number) => ({
            id: s.id || idx + 1,
            name: s.name || s.host?.name || `Server #${s.id || idx + 1}`,
            location: s.country_code || s.location || 'Global',
            provider: s.host?.platform || s.platform || 'VPS',
            online: typeof s.status?.online === 'boolean' ? s.status.online : typeof s.online === 'boolean' ? s.online : false,
            cpu: Math.round(s.status?.cpu || s.cpu || 0),
            ram: Math.round(s.status?.mem_used && s.status?.mem_total ? (s.status.mem_used / s.status.mem_total) * 100 : s.ram || 0),
            upSpeed: `${((s.status?.net_out_speed || s.up_speed || 0) / 1024 / 1024).toFixed(1)} Mbps`,
            downSpeed: `${((s.status?.net_in_speed || s.down_speed || 0) / 1024 / 1024).toFixed(1)} Mbps`,
          }));
        }
      }
    } catch {
      return Response.json({ error: 'Nezha telemetry is unreachable.' }, { status: 502 });
    }
  }

  if (servers.length === 0) {
    return Response.json({ error: 'Nezha returned no server telemetry.' }, { status: 502 });
  }

  const onlineCount = servers.filter((s) => s.online).length;
  const totalCount = servers.length;
  const healthStatus = onlineCount === totalCount ? 'all_normal' : onlineCount > 0 ? 'degraded' : 'critical';

  const payload: ServerMonitorResponse = {
    total: totalCount,
    online: onlineCount,
    status: healthStatus,
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
};
